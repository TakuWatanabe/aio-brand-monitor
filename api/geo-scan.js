// api/geo-scan.js
// Phase 2: GEO Score Calculation Endpoint
// POST /api/geo-scan?client_id=xxx  — triggers full GEO scan for a client's influencers
// Also called by cron: api/cron/weekly-scores.js after weekly measurement

import supabaseAdmin from '../lib/supabaseAdmin.js';
import { measureInfluencerMentions } from '../lib/aiMeasurement.js';

export default async function handler(req, res) {
  // Allow both GET (cron) and POST (manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: require service key header OR internal cron secret
  const authHeader = req.headers['authorization'] || '';
  const cronSecret = req.headers['x-cron-secret'] || '';
  const isAuthorized =
    authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` ||
    cronSecret === process.env.CRON_SECRET;

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const clientId = req.query.client_id || req.body?.client_id;

  try {
    // Fetch clients to scan
    let clientQuery = supabaseAdmin.from('clients').select('id, name, keywords, brand_name');
    if (clientId) clientQuery = clientQuery.eq('id', clientId);
    const { data: clients, error: clientErr } = await clientQuery;
    if (clientErr) throw clientErr;
    if (!clients || clients.length === 0) {
      return res.status(200).json({ message: 'No clients found', scanned: 0 });
    }

    const today = new Date().toISOString().split('T')[0];
    const results = [];

    for (const client of clients) {
      // Fetch influencers for this client
      const { data: influencers, error: infErr } = await supabaseAdmin
        .from('influencers')
        .select('id, name, sns_handle, geo_platform, followers, category')
        .eq('client_id', client.id);

      if (infErr || !influencers || influencers.length === 0) {
        results.push({ client_id: client.id, name: client.name, influencers_scanned: 0 });
        continue;
      }

      // Build keyword list from client keywords
      const keywords = (client.keywords || []).slice(0, 5);
      if (keywords.length === 0 && client.brand_name) keywords.push(client.brand_name);

      let clientCitationRows = [];
      let clientGeoFlags = {};

      for (const influencer of influencers) {
        let mentionResults = {};
        try {
          mentionResults = await measureInfluencerMentions(influencer, keywords);
        } catch (e) {
          console.error(`[GEO] measureInfluencerMentions error for ${influencer.name}:`, e.message);
          continue;
        }

        const engineMap = { chatgpt: 'chatgpt', perplexity: 'perplexity', google_aio: 'google_aio', gemini: 'gemini', claude: 'claude' };
        let anyMentioned = false;
        const geoFlags = {};

        for (const [engineKey, engineName] of Object.entries(engineMap)) {
          const engineResult = mentionResults[engineKey];
          if (!engineResult) continue;
          if (engineResult.mentioned || (engineResult.urls && engineResult.urls.length > 0)) {
            anyMentioned = true;
            geoFlags[`cited_by_${engineName}`] = true;
            const urlsToRecord = engineResult.urls && engineResult.urls.length > 0 ? engineResult.urls.slice(0, 3) : ['(テキスト言及)'];
            for (const citedUrl of urlsToRecord) {
              clientCitationRows.push({
                client_id: client.id, influencer_id: influencer.id, campaign_id: null,
                ai_engine: engineName, keyword: keywords[0] || null, cited_url: citedUrl,
                citation_text: engineResult.excerpt || null, is_brand_mentioned: true, measured_at: new Date().toISOString(),
              });
            }
          }
        }

        if (anyMentioned) clientGeoFlags[influencer.id] = geoFlags;

        const weights = { chatgpt: 30, perplexity: 25, google_aio: 20, gemini: 15, claude: 10 };
        let geoScore = 0;
        for (const [engine, weight] of Object.entries(weights)) {
          if (geoFlags[`cited_by_${engine}`]) geoScore += weight;
        }

        await supabaseAdmin.from('geo_scores').upsert(
          { influencer_id: influencer.id, client_id: client.id, scored_at: today, geo_score: geoScore,
            cited_by_chatgpt: !!geoFlags.cited_by_chatgpt, cited_by_perplexity: !!geoFlags.cited_by_perplexity,
            cited_by_google_aio: !!geoFlags.cited_by_google_aio, cited_by_gemini: !!geoFlags.cited_by_gemini, cited_by_claude: !!geoFlags.cited_by_claude },
          { onConflict: 'influencer_id,scored_at' }
        );
        await supabaseAdmin.from('influencers').update({ geo_score: geoScore, geo_scored_at: today }).eq('id', influencer.id);
      }

      if (clientCitationRows.length > 0) {
        const { error: citErr } = await supabaseAdmin.from('ai_citations').insert(clientCitationRows);
        if (citErr) console.error('[GEO] ai_citations insert error:', citErr.message);
      }

      results.push({ client_id: client.id, name: client.name, influencers_scanned: influencers.length, citations_recorded: clientCitationRows.length, geo_flags_set: Object.keys(clientGeoFlags).length });
      console.log(`[GEO] ${client.name}: ${influencers.length} influencers scanned, ${clientCitationRows.length} citations recorded`);
    }

    return res.status(200).json({ success: true, date: today, clients_scanned: clients.length, results });
  } catch (err) {
    console.error('[GEO] geo-scan error:', err);
    return res.status(500).json({ error: err.message });
  }
}
