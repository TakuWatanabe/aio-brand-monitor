// api/measure.js - Phase 1統合: ai_citations・geo_scores・campaign_scores への自動書き込みを追加
const supabaseAdmin = require('../lib/supabaseAdmin');
const {
  measureWithChatGPT, measureWithPerplexity, measureWithGoogleAI,
  measureWithGemini, measureWithClaude, measureKeywordPresences,
  measureKeywordGoogleAI, measureCompetitorListings, scoreCompetitorsFromResponses,
  aggregateCitationsByDomain, getWeekStart, getCurrentMonth,
} = require('../lib/aiMeasurement');
const { updateKeywordsWithGSC } = require('../lib/gscClient');

function urlMatchesInfluencer(url, handle, platform) {
  if (!url || !handle) return false;
  const u = url.toLowerCase(); const h = handle.toLowerCase().replace(/^@/, ''); const p = (platform || '').toLowerCase();
  if (p === 'youtube')   return u.includes('youtube.com/@' + h) || u.includes('youtube.com/c/' + h);
  if (p === 'note')      return u.includes('note.com/' + h);
  if (p === 'instagram') return u.includes('instagram.com/' + h);
  if (p === 'x' || p === 'twitter') return u.includes('twitter.com/' + h) || u.includes('x.com/' + h);
  if (p === 'ameblo')    return u.includes('ameblo.jp/' + h);
  return u.includes('/' + h);
}

function extractInfluencerCitations({ engineName, result, influencers, clientId, campaignId }) {
  if (!result || result.skipped || !influencers.length) return { rows: [], flagsByInfluencer: {} };
  const engineUrls = result.citations || []; const details = result.details || [];
  const rows = []; const flagsByInfluencer = {};
  for (const inf of influencers) {
    const handle = (inf.sns_handle || '').replace(/^@/, '').toLowerCase();
    const matchedUrls = engineUrls.filter(url => urlMatchesInfluencer(url, handle, inf.geo_platform));
    const mentionedInText = details.some(d => {
      const text = (d.response || '').toLowerCase();
      return (inf.name && text.includes(inf.name.toLowerCase())) || (handle && text.includes(handle));
    });
    if (matchedUrls.length > 0 || mentionedInText) {
      flagsByInfluencer[inf.id] = flagsByInfluencer[inf.id] || {};
      flagsByInfluencer[inf.id][`cited_by_${engineName}`] = true;
      const urlsToRecord = matchedUrls.length > 0 ? matchedUrls.slice(0, 3) : ['(テキスト言及)'];
      for (const citedUrl of urlsToRecord) {
        rows.push({ client_id: clientId, influencer_id: inf.id, campaign_id: campaignId || null,
          ai_engine: engineName, keyword: null, cited_url: citedUrl,
          citation_text: null, is_brand_mentioned: true, measured_at: new Date().toISOString() });
      }
    }
  }
  return { rows, flagsByInfluencer };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  let userEmail;
  try {
    const payloadBase64 = token.split('.')[1];
    const padded = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const payload = JSON.parse(Buffer.from(padded + pad, 'base64').toString('utf-8'));
    userEmail = payload.email || payload.user_metadata?.email || payload.identities?.[0]?.identity_data?.email;
    if (!userEmail) throw new Error('email not found in token');
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return res.status(401).json({ error: 'トークンの有効期限が切れています' });
  } catch (e) { return res.status(401).json({ error: 'トークンが無効です', detail: e.message }); }

  const { data: client, error: clientError } = await supabaseAdmin.from('clients').select('*').eq('email', userEmail).single();
  if (clientError || !client) return res.status(404).json({ error: 'クライアントが見つかりません' });

  const brandNames = client.brand_names || [client.brand_name || client.name];
  const industry = client.industry || '食品・調味料';
  const weekStart = getWeekStart();

  try {
    console.log(`[計測開始] ${client.name} / ${industry} / brandNames: ${brandNames.join(', ')}`);
    const [chatgptResult, perplexityResult, googleAIResult, geminiResult, claudeResult] = await Promise.all([
      measureWithChatGPT(brandNames, industry), measureWithPerplexity(brandNames, industry),
      measureWithGoogleAI(brandNames, industry), measureWithGemini(brandNames, industry), measureWithClaude(brandNames, industry),
    ]);
    console.log(`[計測完了] ChatGPT: ${chatgptResult.score}pt / Perplexity: ${perplexityResult.score}pt / GoogleAI: ${googleAIResult.score}pt / Gemini: ${geminiResult.score}pt / Claude: ${claudeResult.score}pt`);

    const activeEngines = [
      { result: chatgptResult, weight: 0.30 }, { result: perplexityResult, weight: 0.30 },
      { result: googleAIResult, weight: 0.15 }, { result: geminiResult, weight: 0.10 }, { result: claudeResult, weight: 0.15 },
    ].filter(e => !e.result.skipped);
    const totalWeight = activeEngines.reduce((sum, e) => sum + e.weight, 0);
    const overallScore = totalWeight > 0 ? Math.round(activeEngines.reduce((sum, e) => sum + e.result.score * (e.weight / totalWeight), 0)) : 0;

    const allCitationUrls = [
      ...(chatgptResult.citations || []), ...(perplexityResult.citations || []),
      ...(googleAIResult.skipped ? [] : (googleAIResult.citations || [])),
      ...(geminiResult.skipped ? [] : (geminiResult.citations || [])),
      ...(claudeResult.skipped ? [] : (claudeResult.citations || [])),
    ];
    const citations = aggregateCitationsByDomain(allCitationUrls);
    console.log(`[引用URL] ${citations.length}ドメインを集約`);

    const scoresToUpsert = [
      { client_id: client.id, ai_engine: 'chatgpt', score: chatgptResult.score, mention_count: chatgptResult.mentionCount, total_queries: chatgptResult.totalQueries, week_start: weekStart },
      { client_id: client.id, ai_engine: 'perplexity', score: perplexityResult.score, mention_count: perplexityResult.mentionCount, total_queries: perplexityResult.totalQueries, week_start: weekStart },
    ];
    if (!googleAIResult.skipped) scoresToUpsert.push({ client_id: client.id, ai_engine: 'google_ai', score: googleAIResult.score, mention_count: googleAIResult.mentionCount, total_queries: googleAIResult.totalQueries, week_start: weekStart });
    if (!geminiResult.skipped) scoresToUpsert.push({ client_id: client.id, ai_engine: 'gemini', score: geminiResult.score, mention_count: geminiResult.mentionCount, total_queries: geminiResult.totalQueries, week_start: weekStart });
    if (!claudeResult.skipped) scoresToUpsert.push({ client_id: client.id, ai_engine: 'claude', score: claudeResult.score, mention_count: claudeResult.mentionCount, total_queries: claudeResult.totalQueries, week_start: weekStart });
    const { error: insertError } = await supabaseAdmin.from('ai_scores').upsert(scoresToUpsert, { onConflict: 'client_id,ai_engine,week_start' });
    if (insertError) console.error('[DB] ai_scores 保存エラー:', insertError);

    const engines = JSON.parse(JSON.stringify(client.engines || []));
    const chatgptEngine = engines.find(e => e.name === 'ChatGPT'); const perplexityEngine = engines.find(e => e.name === 'Perplexity');
    const googleAIEngine = engines.find(e => e.name === 'Google AI Overview'); const geminiEngine = engines.find(e => e.name === 'Gemini');
    let claudeEngine = engines.find(e => e.name === 'Claude');
    if (chatgptEngine) chatgptEngine.val = chatgptResult.score; if (perplexityEngine) perplexityEngine.val = perplexityResult.score;
    if (googleAIEngine && !googleAIResult.skipped) googleAIEngine.val = googleAIResult.score;
    if (geminiEngine && !geminiResult.skipped) geminiEngine.val = geminiResult.score;
    if (!claudeResult.skipped) { if (!claudeEngine) engines.push({ name: 'Claude', val: claudeResult.score, color: '#D97706' }); else claudeEngine.val = claudeResult.score; }

    const trend = JSON.parse(JSON.stringify(client.trend || [])); const currentMonth = getCurrentMonth();
    const existingTrend = trend.find(t => t.month === currentMonth);
    if (existingTrend) existingTrend.score = overallScore; else trend.push({ month: currentMonth, mentions: 0, score: overallScore });
    const recentTrend = trend.slice(-6);

    const kpi = JSON.parse(JSON.stringify(client.kpi || [])); const scoreKpi = kpi.find(k => k.label === 'AIOスコア');
    if (scoreKpi) { const diff = overallScore - client.current_score; scoreKpi.val = String(overallScore); scoreKpi.change = `${diff >= 0 ? '+' : ''}${diff}pt`; scoreKpi.dir = diff >= 0 ? 'up' : 'down'; }

    let updatedKeywords = client.keywords || [];
    if (updatedKeywords.length > 0) {
      console.log(`[KW計測開始] ${updatedKeywords.length}件`);
      updatedKeywords = await measureKeywordPresences(updatedKeywords, brandNames);
      const brandDomain = process.env.GSC_SITE_URL ? (() => { try { return new URL(process.env.GSC_SITE_URL).hostname; } catch { return null; } })() : null;
      updatedKeywords = await measureKeywordGoogleAI(updatedKeywords, brandNames, brandDomain);
      if (process.env.GSC_SERVICE_ACCOUNT && process.env.GSC_SITE_URL) updatedKeywords = await updateKeywordsWithGSC(updatedKeywords, process.env.GSC_SITE_URL, process.env.GSC_SERVICE_ACCOUNT);
      else console.log('[GSC] 環境変数未設定のためスキップします');
      console.log('[KW計測完了]');
    }

    let updatedCompetitors = client.competitors || [];
    if (updatedCompetitors.length > 0) {
      const selfResponses = [...chatgptResult.details, ...perplexityResult.details, ...(geminiResult.skipped ? [] : geminiResult.details), ...(claudeResult.skipped ? [] : claudeResult.details)];
      const listingResponses = await measureCompetitorListings(industry);
      console.log(`[競合計測] ${selfResponses.length}件 + ${listingResponses.length}件`);
      updatedCompetitors = scoreCompetitorsFromResponses(updatedCompetitors, [...selfResponses, ...listingResponses], overallScore);
    }

    // ============================================================
    // Phase 1 統合: ai_citations / geo_scores / campaign_scores
    // ============================================================
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: dbInfluencers } = await supabaseAdmin.from('influencers').select('id, name, sns_handle, geo_platform, followers, category').eq('client_id', client.id);
      if (dbInfluencers && dbInfluencers.length > 0) {
        const { data: activeCampaigns } = await supabaseAdmin.from('campaigns').select('id, name, keywords').eq('client_id', client.id).lte('start_date', today).gte('end_date', today).limit(1);
        const activeCampaign = activeCampaigns?.[0] || null;
        if (activeCampaign) console.log(`[GEO] アクティブキャンペーン: ${activeCampaign.name}`);
        const engineDefs = [
          { name: 'chatgpt', result: chatgptResult }, { name: 'perplexity', result: perplexityResult },
          { name: 'google_aio', result: googleAIResult }, { name: 'gemini', result: geminiResult }, { name: 'claude', result: claudeResult },
        ];
        const allCitationRows = []; const mergedGeoFlags = {};
        for (const { name: engineName, result } of engineDefs) {
          const { rows, flagsByInfluencer } = extractInfluencerCitations({ engineName, result, influencers: dbInfluencers, clientId: client.id, campaignId: activeCampaign?.id });
          allCitationRows.push(...rows);
          for (const [infId, flags] of Object.entries(flagsByInfluencer)) mergedGeoFlags[infId] = { ...(mergedGeoFlags[infId] || {}), ...flags };
        }
        if (allCitationRows.length > 0) {
          const { error: citError } = await supabaseAdmin.from('ai_citations').insert(allCitationRows);
          if (citError) console.error('[DB] ai_citations 保存エラー:', citError);
          else console.log(`[GEO] ${allCitationRows.length}件の引用を記録`);
        } else { console.log('[GEO] インフルエンサー引用は検出されませんでした'); }
        for (const [infId, flags] of Object.entries(mergedGeoFlags)) {
          await supabaseAdmin.from('geo_scores').upsert({ influencer_id: infId, client_id: client.id, scored_at: today, ...flags }, { onConflict: 'influencer_id,scored_at' });
        }
        if (activeCampaign) {
          const { data: existingScore } = await supabaseAdmin.from('campaign_scores').select('id').eq('campaign_id', activeCampaign.id).eq('measured_at', today).limit(1);
          if (!existingScore || existingScore.length === 0) {
            await supabaseAdmin.from('campaign_scores').insert({
              campaign_id: activeCampaign.id, measured_at: today, aio_score: overallScore,
              chatgpt_score: chatgptResult.score, perplexity_score: perplexityResult.score,
              google_aio_score: googleAIResult.skipped ? null : googleAIResult.score,
              gemini_score: geminiResult.skipped ? null : geminiResult.score,
              claude_score: claudeResult.skipped ? null : claudeResult.score,
              citation_count: allCitationRows.length,
            });
            console.log(`[GEO] campaign_scores 記録: aio=${overallScore}`);
          }
        }
      }
    } catch (geoErr) { console.error('[GEO] 引用記録エラー（メイン計測は正常）:', geoErr.message); }
    // ============================================================

    const { error: updateError } = await supabaseAdmin.from('clients').update({
      current_score: overallScore, score_change: `${overallScore - client.current_score >= 0 ? '+' : ''}${overallScore - client.current_score}`,
      engines, trend: recentTrend, kpi, keywords: updatedKeywords, competitors: updatedCompetitors, citations,
      updated_at: new Date().toISOString(),
    }).eq('id', client.id);
    if (updateError) console.error('[DB] clients 更新エラー:', updateError);

    const sorted = [...updatedCompetitors].sort((a, b) => b.score - a.score);
    const selfRank = sorted.findIndex(c => c.self) + 1;
    return res.status(200).json({
      success: true, clientName: client.name, overallScore,
      chatgpt: { score: chatgptResult.score, mentions: chatgptResult.mentionCount, total: chatgptResult.totalQueries },
      perplexity: { score: perplexityResult.score, mentions: perplexityResult.mentionCount, total: perplexityResult.totalQueries },
      googleAI: { score: googleAIResult.score, mentions: googleAIResult.mentionCount, total: googleAIResult.totalQueries, skipped: googleAIResult.skipped || false },
      gemini: { score: geminiResult.score, mentions: geminiResult.mentionCount, total: geminiResult.totalQueries, skipped: geminiResult.skipped || false, skipReason: geminiResult.skipReason || null },
      claude: { score: claudeResult.score, mentions: claudeResult.mentionCount, total: claudeResult.totalQueries, skipped: claudeResult.skipped || false },
      sentiment: (() => {
        const active = [chatgptResult, perplexityResult, geminiResult, claudeResult].filter(r => !r.skipped && r.sentiment);
        const total = { positive: 0, negative: 0, neutral: 0 };
        active.forEach(r => { total.positive += r.sentiment.positive || 0; total.negative += r.sentiment.negative || 0; total.neutral += r.sentiment.neutral || 0; });
        const sum = total.positive + total.negative + total.neutral || 1;
        return { positive: Math.round(total.positive / sum * 100), negative: Math.round(total.negative / sum * 100), neutral: Math.round(total.neutral / sum * 100), raw: total };
      })(),
      citations, competitors: updatedCompetitors, selfRank, totalCompetitors: updatedCompetitors.length,
    });
  } catch (err) {
    console.error('[計測エラー]', err);
    return res.status(500).json({ error: '計測に失敗しました', detail: err.message });
  }
};
