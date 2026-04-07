// api/cron/weekly-scores.js
// GET /api/cron/weekly-scores
// 毎週月曜日に全クライアントのAIスコアを自動計測し、週次レポートメールを送信する (Vercel Cron Job)
// vercel.json: { "path": "/api/cron/weekly-scores", "schedule": "0 9 * * 1" }

const supabaseAdmin = require('../../lib/supabaseAdmin');
const {
  measureWithChatGPT,
  measureWithPerplexity,
  measureWithGoogleAI,
  measureWithGemini,
  measureWithClaude,
  measureKeywordPresences,
  measureKeywordGoogleAI,
  measureCompetitorListings,
  scoreCompetitorsFromResponses,
  measureInfluencerMentions,
  buildBarDataFromInfluencers,
  getWeekStart,
  getCurrentMonth,
} = require('../../lib/aiMeasurement');
const { updateKeywordsWithGSC } = require('../../lib/gscClient');
const { buildReportHtml, sendReportEmail } = require('../../lib/emailReport');
const { buildGeoReportSection } = require('../../lib/geoReportSection');

module.exports = async (req, res) => {
  // Vercel Cron は Authorization ヘッダーに CRON_SECRET をセットして呼び出す
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') return res.status(405).end();

  console.log('[週次クロン] 全クライアントのAIスコア計測を開始');

  // === 全クライアントを取得 ===
  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select('*');

  if (error || !clients) {
    return res.status(500).json({ error: 'クライアント一覧の取得に失敗しました' });
  }

  const weekStart = getWeekStart();
  const currentMonth = getCurrentMonth();
  const results = [];

  for (const client of clients) {
    const brandNames = client.brand_names || [client.brand_name || client.name];
    const industry = client.industry || '食品・調味料';

    try {
      console.log(`[計測中] ${client.name} / brandNames: ${brandNames.join(', ')}`);

      // === 5エンジン並列計測 ===
      const [chatgptResult, perplexityResult, googleAIResult, geminiResult, claudeResult] = await Promise.all([
        measureWithChatGPT(brandNames, industry),
        measureWithPerplexity(brandNames, industry),
        measureWithGoogleAI(brandNames, industry),
        measureWithGemini(brandNames, industry),
        measureWithClaude(brandNames, industry),
      ]);

      console.log(`[計測完了] ${client.name}: ChatGPT ${chatgptResult.score}pt / Perplexity ${perplexityResult.score}pt / GoogleAI ${googleAIResult.score}pt / Gemini ${geminiResult.score}pt / Claude ${claudeResult.score}pt`);

      // === 総合スコアを計算（有効エンジンの加重平均）===
      const activeEngines = [
        { result: chatgptResult,    weight: 0.30 },
        { result: perplexityResult, weight: 0.30 },
        { result: googleAIResult,   weight: 0.15 },
        { result: geminiResult,     weight: 0.10 },
        { result: claudeResult,     weight: 0.15 },
      ].filter(e => !e.result.skipped);

      const totalWeight = activeEngines.reduce((sum, e) => sum + e.weight, 0);
      const overallScore = totalWeight > 0
        ? Math.round(activeEngines.reduce((sum, e) => sum + e.result.score * (e.weight / totalWeight), 0))
        : 0;

      // === ai_scores に保存 ===
      const scoresToUpsert = [
        { client_id: client.id, ai_engine: 'chatgpt',    score: chatgptResult.score,    mention_count: chatgptResult.mentionCount,    total_queries: chatgptResult.totalQueries,    week_start: weekStart },
        { client_id: client.id, ai_engine: 'perplexity', score: perplexityResult.score, mention_count: perplexityResult.mentionCount, total_queries: perplexityResult.totalQueries, week_start: weekStart },
      ];
      if (!googleAIResult.skipped) {
        scoresToUpsert.push({ client_id: client.id, ai_engine: 'google_ai', score: googleAIResult.score, mention_count: googleAIResult.mentionCount, total_queries: googleAIResult.totalQueries, week_start: weekStart });
      }
      if (!geminiResult.skipped) {
        scoresToUpsert.push({ client_id: client.id, ai_engine: 'gemini', score: geminiResult.score, mention_count: geminiResult.mentionCount, total_queries: geminiResult.totalQueries, week_start: weekStart });
      }
      if (!claudeResult.skipped) {
        scoresToUpsert.push({ client_id: client.id, ai_engine: 'claude', score: claudeResult.score, mention_count: claudeResult.mentionCount, total_queries: claudeResult.totalQueries, week_start: weekStart });
      }
      await supabaseAdmin.from('ai_scores').upsert(scoresToUpsert, { onConflict: 'client_id,ai_engine,week_start' });

      // === engines 更新 ===
      const engines = JSON.parse(JSON.stringify(client.engines || []));
      const chatgptEngine    = engines.find(e => e.name === 'ChatGPT');
      const perplexityEngine = engines.find(e => e.name === 'Perplexity');
      const googleAIEngine   = engines.find(e => e.name === 'Google AI Overview');
      const geminiEngine     = engines.find(e => e.name === 'Gemini');
      let claudeEngine       = engines.find(e => e.name === 'Claude');
      if (chatgptEngine) chatgptEngine.val = chatgptResult.score;
      if (perplexityEngine) perplexityEngine.val = perplexityResult.score;
      if (googleAIEngine && !googleAIResult.skipped) googleAIEngine.val = googleAIResult.score;
      if (geminiEngine && !geminiResult.skipped) geminiEngine.val = geminiResult.score;
      if (!claudeResult.skipped) {
        if (!claudeEngine) {
          engines.push({ name: 'Claude', val: claudeResult.score, color: '#D97706' });
        } else {
          claudeEngine.val = claudeResult.score;
        }
      }

      // === trend 更新（最新6ヶ月）===
      const trend = JSON.parse(JSON.stringify(client.trend || []));
      const existing = trend.find(t => t.month === currentMonth);
      if (existing) {
        existing.score = overallScore;
      } else {
        trend.push({ month: currentMonth, mentions: 0, score: overallScore });
      }

      // === KPI 更新 ===
      const kpi = JSON.parse(JSON.stringify(client.kpi || []));
      const scoreKpi = kpi.find(k => k.label === 'AIOスコア');
      if (scoreKpi) {
        const diff = overallScore - (client.current_score || 0);
        scoreKpi.val = String(overallScore);
        scoreKpi.change = `${diff >= 0 ? '+' : ''}${diff}pt`;
        scoreKpi.dir = diff >= 0 ? 'up' : 'down';
      }

      // === キーワード計測 ===
      let updatedKeywords = client.keywords || [];
      if (updatedKeywords.length > 0) {
        updatedKeywords = await measureKeywordPresences(updatedKeywords, brandNames);
        updatedKeywords = await measureKeywordGoogleAI(updatedKeywords, brandNames);
        const gscServiceAccount = process.env.GSC_SERVICE_ACCOUNT;
        const gscSiteUrl = process.env.GSC_SITE_URL;
        if (gscServiceAccount && gscSiteUrl) {
          updatedKeywords = await updateKeywordsWithGSC(updatedKeywords, gscSiteUrl, gscServiceAccount);
        }
      }

      // === 競合スコア算出 ===
      let updatedCompetitors = client.competitors || [];
      if (updatedCompetitors.length > 0) {
        const selfResponses = [
          ...chatgptResult.details,
          ...perplexityResult.details,
          ...(geminiResult.skipped ? [] : geminiResult.details),
          ...(claudeResult.skipped ? [] : claudeResult.details),
        ];
        const listingResponses = await measureCompetitorListings(industry);
        const allResponses = [...selfResponses, ...listingResponses];
        updatedCompetitors = scoreCompetitorsFromResponses(updatedCompetitors, allResponses, overallScore);
      }

      // === インフルエンサーAI言及数を自動計測 ===
      let updatedInfluencers = client.influencers || [];
      let updatedBarData = client.bar_data || [];
      if (updatedInfluencers.length > 0) {
        console.log(`[週次] ${client.name}: インフルエンサー計測開始 (${updatedInfluencers.length}名)`);
        updatedInfluencers = await measureInfluencerMentions(updatedInfluencers, brandNames, industry);
        updatedBarData = buildBarDataFromInfluencers(updatedInfluencers);
        console.log(`[週次] ${client.name}: インフルエンサー計測完了`);
      }

            // === geo_scores テーブルへ書き込み ===
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: infRows } = await supabaseAdmin
          .from('influencers').select('id, name, sns_handle').eq('client_id', client.id);
        if (infRows && infRows.length > 0 && updatedInfluencers.length > 0) {
          const geoUpserts = [];
          for (const inf of updatedInfluencers) {
            const row = infRows.find(r =>
              (r.name && inf.name && r.name === inf.name) ||
              (r.sns_handle && (r.sns_handle === inf.handle || r.sns_handle === inf.sns_handle))
            );
            if (!row) continue;
            const geoScore = +(inf.geo_score || 0);
            geoUpserts.push({
              influencer_id: row.id,
              client_id: client.id,
              scored_at: today,
              geo_score: geoScore,
              cited_by_chatgpt:    !!(inf.cited_by_chatgpt    || inf.chatgpt_cited),
              cited_by_perplexity: !!(inf.cited_by_perplexity || inf.perplexity_cited),
              cited_by_google_aio: !!(inf.cited_by_google_aio || inf.google_aio_cited),
              cited_by_gemini:     !!(inf.cited_by_gemini     || inf.gemini_cited),
              cited_by_claude:     !!(inf.cited_by_claude     || inf.claude_cited),
            });
          }
          if (geoUpserts.length > 0) {
            await supabaseAdmin.from('geo_scores')
              .upsert(geoUpserts, { onConflict: 'influencer_id,scored_at' });
            console.log('[GEO] ' + client.name + ': geo_scores ' + geoUpserts.length + '');
          }
        }
      } catch (geoErr) {
        console.error('[GEO] geo_scores upsert error:', geoErr.message);
      }

// === clients テーブル更新 ===
      await supabaseAdmin.from('clients').update({
        current_score: overallScore,
        score_change: `${overallScore - (client.current_score || 0) >= 0 ? '+' : ''}${overallScore - (client.current_score || 0)}`,
        engines,
        trend: trend.slice(-6),
        kpi,
        keywords: updatedKeywords,
        competitors: updatedCompetitors,
        influencers: updatedInfluencers,
        bar_data: updatedBarData,
        updated_at: new Date().toISOString(),
      }).eq('id', client.id);

      // === 週次レポートメール送信 ===
      // client.email がある場合のみ送信
      let emailResult = { ok: false, error: 'no email address' };
      if (client.email) {
        const enginesPayload = {
          chatgpt:    { score: chatgptResult.score,    mentions: chatgptResult.mentionCount,    total: chatgptResult.totalQueries,    skipped: false },
          perplexity: { score: perplexityResult.score, mentions: perplexityResult.mentionCount, total: perplexityResult.totalQueries, skipped: false },
          googleAI:   { score: googleAIResult.score,   mentions: googleAIResult.mentionCount,   total: googleAIResult.totalQueries,   skipped: googleAIResult.skipped || false },
          gemini:     { score: geminiResult.score,     mentions: geminiResult.mentionCount,     total: geminiResult.totalQueries,     skipped: geminiResult.skipped || false },
        };

        // 更新後のデータ（keywords・competitors）をレポート用クライアントに反映
        const clientForReport = {
          ...client,
          keywords: updatedKeywords,
          competitors: updatedCompetitors,
          current_score: overallScore,
        };

        const html = buildReportHtml(clientForReport, overallScore, enginesPayload);
        // === GEO report section ===
        let geoReportHtml = '';
        try {
          const geoSec = await buildGeoReportSection(client.id, weekStart, weekStart);
          if (geoSec && geoSec.hasData) geoReportHtml = geoSec.html;
        } catch (geoErr) {
          console.error('[GEO Report]', geoErr.message);
        }
        emailResult = await sendReportEmail({
          to: client.email,
          clientName: client.name,
          html: html + geoReportHtml,
        });
      } else {
        console.log(`[Email] ${client.name}: email アドレス未設定のためスキップ`);
      }

      results.push({
        id: client.id,
        name: client.name,
        overallScore,
        email: emailResult.ok ? 'sent' : `skipped (${emailResult.error})`,
        status: 'success',
      });
      console.log(`[完了] ${client.name}: ${overallScore}pt / email: ${emailResult.ok ? '送信済み' : 'スキップ'}`);

    } catch (err) {
      console.error(`[エラー] ${client.name}: ${err.message}`);
      results.push({ id: client.id, name: client.name, error: err.message, status: 'error' });
    }

    // クライアント間で1秒待機（APIレート対策）
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('[週次クロン] 全処理完了:', results);
  return res.status(200).json({ success: true, weekStart, results });
};
