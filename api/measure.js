// api/measure.js
// POST /api/measure
// ログイン中クライアントのAIスコアをリアルタイムで計測し、Supabaseに保存する

const supabaseAdmin = require('../lib/supabaseAdmin');
const { createClient } = require('@supabase/supabase-js');
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
  aggregateCitationsByDomain,
  getWeekStart,
  getCurrentMonth,
} = require('../lib/aiMeasurement');
const { updateKeywordsWithGSC } = require('../lib/gscClient');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // === 認証チェック（JWT デコードでメール取得）===
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let userEmail;
  try {
    const payloadBase64 = token.split('.')[1];
    // base64url → base64 変換（パディング補完）
    const padded = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const payload = JSON.parse(Buffer.from(padded + pad, 'base64').toString('utf-8'));

    // 複数の場所からメールを取得（Supabase バージョンによって異なる）
    userEmail = payload.email
      || payload.user_metadata?.email
      || payload.identities?.[0]?.identity_data?.email;

    if (!userEmail) {
      console.log('[JWT measure] email not found. keys:', Object.keys(payload));
      throw new Error('email not found in token');
    }
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: 'トークンの有効期限が切れています' });
    }
  } catch (e) {
    return res.status(401).json({ error: 'トークンが無効です', detail: e.message });
  }

  // === クライアント情報をDBから取得 ===
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('email', userEmail)
    .single();

  if (clientError || !client) {
    return res.status(404).json({ error: 'クライアントが見つかりません' });
  }

  const brandNames = client.brand_names || [client.brand_name || client.name];
  const industry = client.industry || '食品・調味料';
  const weekStart = getWeekStart();

  try {
    console.log(`[計測開始] ${client.name} / ${industry} / brandNames: ${brandNames.join(', ')}`);

    // === 5エンジン並列計測 ===
    const [chatgptResult, perplexityResult, googleAIResult, geminiResult, claudeResult] = await Promise.all([
      measureWithChatGPT(brandNames, industry),
      measureWithPerplexity(brandNames, industry),
      measureWithGoogleAI(brandNames, industry),
      measureWithGemini(brandNames, industry),
      measureWithClaude(brandNames, industry),
    ]);

    console.log(`[計測完了] ChatGPT: ${chatgptResult.score}pt / Perplexity: ${perplexityResult.score}pt / GoogleAI: ${googleAIResult.score}pt / Gemini: ${geminiResult.score}pt / Claude: ${claudeResult.score}pt`);

    // === 総合スコアを計算（有効なエンジンのみ加重平均）===
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

    // === 引用URLを全エンジンから集約 ===
    const allCitationUrls = [
      ...(chatgptResult.citations || []),
      ...(perplexityResult.citations || []),
      ...(googleAIResult.skipped ? [] : (googleAIResult.citations || [])),
      ...(geminiResult.skipped ? [] : (geminiResult.citations || [])),
      ...(claudeResult.skipped ? [] : (claudeResult.citations || [])),
    ];
    const citations = aggregateCitationsByDomain(allCitationUrls);
    console.log(`[引用URL] ${citations.length}ドメインを集約`);

    // === ai_scores テーブルに保存（同週は上書き）===
    const scoresToUpsert = [
      {
        client_id: client.id,
        ai_engine: 'chatgpt',
        score: chatgptResult.score,
        mention_count: chatgptResult.mentionCount,
        total_queries: chatgptResult.totalQueries,
        week_start: weekStart,
      },
      {
        client_id: client.id,
        ai_engine: 'perplexity',
        score: perplexityResult.score,
        mention_count: perplexityResult.mentionCount,
        total_queries: perplexityResult.totalQueries,
        week_start: weekStart,
      },
    ];
    // Google AI が有効な場合のみ保存
    if (!googleAIResult.skipped) {
      scoresToUpsert.push({
        client_id: client.id,
        ai_engine: 'google_ai',
        score: googleAIResult.score,
        mention_count: googleAIResult.mentionCount,
        total_queries: googleAIResult.totalQueries,
        week_start: weekStart,
      });
    }
    // Gemini が有効な場合のみ保存
    if (!geminiResult.skipped) {
      scoresToUpsert.push({
        client_id: client.id,
        ai_engine: 'gemini',
        score: geminiResult.score,
        mention_count: geminiResult.mentionCount,
        total_queries: geminiResult.totalQueries,
        week_start: weekStart,
      });
    }
    // Claude が有効な場合のみ保存
    if (!claudeResult.skipped) {
      scoresToUpsert.push({
        client_id: client.id,
        ai_engine: 'claude',
        score: claudeResult.score,
        mention_count: claudeResult.mentionCount,
        total_queries: claudeResult.totalQueries,
        week_start: weekStart,
      });
    }
    const { error: insertError } = await supabaseAdmin.from('ai_scores').upsert(
      scoresToUpsert,
      { onConflict: 'client_id,ai_engine,week_start' }
    );

    if (insertError) console.error('[DB] ai_scores 保存エラー:', insertError);

    // === engines データを更新 ===
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
    // Claude エンジンが未登録の場合は自動追加
    if (!claudeResult.skipped) {
      if (!claudeEngine) {
        engines.push({ name: 'Claude', val: claudeResult.score, color: '#D97706' });
        claudeEngine = engines[engines.length - 1];
      } else {
        claudeEngine.val = claudeResult.score;
      }
    }

    // === trend データを更新（最新6ヶ月を保持）===
    const trend = JSON.parse(JSON.stringify(client.trend || []));
    const currentMonth = getCurrentMonth();
    const existing = trend.find(t => t.month === currentMonth);
    if (existing) {
      existing.score = overallScore;
    } else {
      trend.push({ month: currentMonth, mentions: 0, score: overallScore });
    }
    const recentTrend = trend.slice(-6);

    // === KPI の AIOスコアを更新 ===
    const kpi = JSON.parse(JSON.stringify(client.kpi || []));
    const scoreKpi = kpi.find(k => k.label === 'AIOスコア');
    if (scoreKpi) {
      const diff = overallScore - client.current_score;
      scoreKpi.val = String(overallScore);
      scoreKpi.change = `${diff >= 0 ? '+' : ''}${diff}pt`;
      scoreKpi.dir = diff >= 0 ? 'up' : 'down';
    }

    // === キーワード別 presence を自動計測・更新（ChatGPT + Gemini）===
    let updatedKeywords = client.keywords || [];
    if (updatedKeywords.length > 0) {
      console.log(`[KW計測開始] ${updatedKeywords.length}件のキーワードを計測します`);

      // ① AI 上の存在感（ChatGPT + Gemini）
      updatedKeywords = await measureKeywordPresences(updatedKeywords, brandNames);

      // ② Google AI Overview での言及確認・オーガニック順位取得（SerpAPI）
      //    ※ SerpAPI 無料プラン 100クエリ/月: キーワード数×計測回数を管理すること
      const _siteUrl = process.env.GSC_SITE_URL;
      const brandDomain = _siteUrl ? (() => { try { return new URL(_siteUrl).hostname; } catch { return null; } })() : null;
      updatedKeywords = await measureKeywordGoogleAI(updatedKeywords, brandNames, brandDomain);

      // ③ Google Search Console からインプレッション数を取得（vol を自動更新）
      //    ※ GSC_SERVICE_ACCOUNT / GSC_SITE_URL が設定されている場合のみ実行
      const gscServiceAccount = process.env.GSC_SERVICE_ACCOUNT;
      const gscSiteUrl = process.env.GSC_SITE_URL;
      if (gscServiceAccount && gscSiteUrl) {
        updatedKeywords = await updateKeywordsWithGSC(updatedKeywords, gscSiteUrl, gscServiceAccount);
      } else {
        console.log('[GSC] 環境変数未設定のためスキップします（GSC_SERVICE_ACCOUNT / GSC_SITE_URL）');
      }

      console.log('[KW計測完了]');
    }

    // === 競合スコアを算出 ===
    let updatedCompetitors = client.competitors || [];
    if (updatedCompetitors.length > 0) {
      // ① 自社計測レスポンス（ChatGPT + Perplexity + Gemini + Claude）を結合
      const selfResponses = [
        ...chatgptResult.details,
        ...perplexityResult.details,
        ...(geminiResult.skipped ? [] : geminiResult.details),
        ...(claudeResult.skipped ? [] : claudeResult.details),
      ];

      // ② Perplexityで「業界全社リストアップ」クエリを追加実行（中小競合の検出精度向上）
      const listingResponses = await measureCompetitorListings(industry);

      // ③ 自社計測 + リストアップ結果を合算してスコア算出
      const allResponses = [...selfResponses, ...listingResponses];
      console.log(`[競合計測] 自社計測${selfResponses.length}件 + リストアップ${listingResponses.length}件 = 合計${allResponses.length}件から算出`);
      updatedCompetitors = scoreCompetitorsFromResponses(updatedCompetitors, allResponses, overallScore);
    }

    // === clients テーブルを更新（citations も保存）===
    const { error: updateError } = await supabaseAdmin.from('clients').update({
      current_score: overallScore,
      score_change: `${overallScore - client.current_score >= 0 ? '+' : ''}${overallScore - client.current_score}`,
      engines,
      trend: recentTrend,
      kpi,
      keywords: updatedKeywords,
      competitors: updatedCompetitors,
      citations,
      updated_at: new Date().toISOString(),
    }).eq('id', client.id);

    if (updateError) console.error('[DB] clients 更新エラー:', updateError);

    // 競合ランキング情報をレスポンスに含める
    const sorted = [...updatedCompetitors].sort((a, b) => b.score - a.score);
    const selfRank = sorted.findIndex(c => c.self) + 1;

    return res.status(200).json({
      success: true,
      clientName: client.name,
      overallScore,
      chatgpt: {
        score: chatgptResult.score,
        mentions: chatgptResult.mentionCount,
        total: chatgptResult.totalQueries,
      },
      perplexity: {
        score: perplexityResult.score,
        mentions: perplexityResult.mentionCount,
        total: perplexityResult.totalQueries,
      },
      googleAI: {
        score: googleAIResult.score,
        mentions: googleAIResult.mentionCount,
        total: googleAIResult.totalQueries,
        skipped: googleAIResult.skipped || false,
      },
      gemini: {
        score: geminiResult.score,
        mentions: geminiResult.mentionCount,
        total: geminiResult.totalQueries,
        skipped: geminiResult.skipped || false,
        skipReason: geminiResult.skipReason || null,
      },
      claude: {
        score: claudeResult.score,
        mentions: claudeResult.mentionCount,
        total: claudeResult.totalQueries,
        skipped: claudeResult.skipped || false,
      },
      sentiment: (() => {
        const active = [chatgptResult, perplexityResult, geminiResult, claudeResult]
          .filter(r => !r.skipped && r.sentiment);
        const total = { positive: 0, negative: 0, neutral: 0 };
        active.forEach(r => {
          total.positive += r.sentiment.positive || 0;
          total.negative += r.sentiment.negative || 0;
          total.neutral  += r.sentiment.neutral  || 0;
        });
        const sum = total.positive + total.negative + total.neutral || 1;
        return {
          positive: Math.round(total.positive / sum * 100),
          negative: Math.round(total.negative / sum * 100),
          neutral:  Math.round(total.neutral  / sum * 100),
          raw: total,
        };
      })(),
      citations,
      competitors: updatedCompetitors,
      selfRank,
      totalCompetitors: updatedCompetitors.length,
    });
  } catch (err) {
    console.error('[計測エラー]', err);
    return res.status(500).json({ error: '計測に失敗しました', detail: err.message });
  }
};
