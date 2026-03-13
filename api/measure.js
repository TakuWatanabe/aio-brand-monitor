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
  measureKeywordPresences,
  measureCompetitors,
  getWeekStart,
  getCurrentMonth,
} = require('../lib/aiMeasurement');

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

    // === 4エンジン並列計測 ===
    const [chatgptResult, perplexityResult, googleAIResult, geminiResult] = await Promise.all([
      measureWithChatGPT(brandNames, industry),
      measureWithPerplexity(brandNames, industry),
      measureWithGoogleAI(brandNames, industry),
      measureWithGemini(brandNames, industry),
    ]);

    console.log(`[計測完了] ChatGPT: ${chatgptResult.score}pt / Perplexity: ${perplexityResult.score}pt / GoogleAI: ${googleAIResult.score}pt / Gemini: ${geminiResult.score}pt`);

    // === 総合スコアを計算（有効なエンジンのみ加重平均）===
    const activeEngines = [
      { result: chatgptResult,    weight: 0.35 },
      { result: perplexityResult, weight: 0.35 },
      { result: googleAIResult,   weight: 0.15 },
      { result: geminiResult,     weight: 0.15 },
    ].filter(e => !e.result.skipped);

    const totalWeight = activeEngines.reduce((sum, e) => sum + e.weight, 0);
    const overallScore = totalWeight > 0
      ? Math.round(activeEngines.reduce((sum, e) => sum + e.result.score * (e.weight / totalWeight), 0))
      : 0;

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
    if (chatgptEngine) chatgptEngine.val = chatgptResult.score;
    if (perplexityEngine) perplexityEngine.val = perplexityResult.score;
    if (googleAIEngine && !googleAIResult.skipped) googleAIEngine.val = googleAIResult.score;
    if (geminiEngine && !geminiResult.skipped) geminiEngine.val = geminiResult.score;

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

    // === キーワード別 presence を自動計測・更新 ===
    let updatedKeywords = client.keywords || [];
    if (updatedKeywords.length > 0) {
      console.log(`[KW計測開始] ${updatedKeywords.length}件のキーワードを計測します`);
      updatedKeywords = await measureKeywordPresences(updatedKeywords, brandNames);
      console.log('[KW計測完了]');
    }

    // === 競合スコアを自動計測・更新 ===
    let updatedCompetitors = client.competitors || [];
    if (updatedCompetitors.length > 0) {
      console.log(`[競合計測開始] ${updatedCompetitors.filter(c => !c.self).length}社を計測します`);
      updatedCompetitors = await measureCompetitors(updatedCompetitors, industry, overallScore);
      console.log('[競合計測完了]');
    }

    // === clients テーブルを更新 ===
    const { error: updateError } = await supabaseAdmin.from('clients').update({
      current_score: overallScore,
      score_change: `${overallScore - client.current_score >= 0 ? '+' : ''}${overallScore - client.current_score}`,
      engines,
      trend: recentTrend,
      kpi,
      keywords: updatedKeywords,
      competitors: updatedCompetitors,
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
      },
      competitors: updatedCompetitors,
      selfRank,
      totalCompetitors: updatedCompetitors.length,
    });
  } catch (err) {
    console.error('[計測エラー]', err);
    return res.status(500).json({ error: '計測に失敗しました', detail: err.message });
  }
};
