// api/admin/measure.js
// POST /api/admin/measure?id=CLIENT_ID
// 管理者が特定クライアントのAIスコアを今すぐ手動計測する

const supabaseAdmin = require('../../lib/supabaseAdmin');
const { createClient } = require('@supabase/supabase-js');
const {
  measureWithChatGPT,
  measureWithPerplexity,
  measureWithGoogleAI,
  measureWithGemini,
  measureKeywordPresences,
  measureCompetitorListings,
  scoreCompetitorsFromResponses,
  aggregateCitationsByDomain,
  getWeekStart,
  getCurrentMonth,
} = require('../../lib/aiMeasurement');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // === 管理者JWT認証 ===
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return res.status(401).json({ error: '認証に失敗しました' });

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!adminEmails.includes(user.email.toLowerCase())) {
    return res.status(403).json({ error: '管理者権限が必要です' });
  }

  // === クライアントID確認 ===
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'クライアントID（id）が必要です' });

  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients').select('*').eq('id', id).single();
  if (clientError || !client) return res.status(404).json({ error: 'クライアントが見つかりません' });

  const brandNames = client.brand_names || [client.brand_name || client.name];
  const industry   = client.industry || '食品・調味料';
  const weekStart  = getWeekStart();
  const currentMonth = getCurrentMonth();

  console.log(`[手動計測] 開始: ${client.name} / ${industry}`);

  // SSE（Server-Sent Events）でリアルタイム進捗を返す
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send({ step: 'start', message: `${client.name} の計測を開始しました` });

    // === 4エンジン並列計測 ===
    send({ step: 'measuring', message: 'AI検索エンジンに問い合わせ中…' });
    const [chatgptResult, perplexityResult, googleAIResult, geminiResult] = await Promise.all([
      measureWithChatGPT(brandNames, industry),
      measureWithPerplexity(brandNames, industry),
      measureWithGoogleAI(brandNames, industry),
      measureWithGemini(brandNames, industry),
    ]);

    send({ step: 'engines_done', message: 'エンジン計測完了', scores: {
      chatgpt: chatgptResult.score,
      perplexity: perplexityResult.score,
      google_ai: googleAIResult.score,
      gemini: geminiResult.score,
    }});

    // === 総合スコア計算 ===
    const activeEngines = [
      { result: chatgptResult,    weight: 0.35, name: 'chatgpt' },
      { result: perplexityResult, weight: 0.35, name: 'perplexity' },
      { result: googleAIResult,   weight: 0.15, name: 'google_ai' },
      { result: geminiResult,     weight: 0.15, name: 'gemini' },
    ].filter(e => !e.result.skipped);

    const totalWeight = activeEngines.reduce((sum, e) => sum + e.weight, 0);
    const overallScore = totalWeight > 0
      ? Math.round(activeEngines.reduce((sum, e) => sum + e.result.score * (e.weight / totalWeight), 0))
      : 0;

    // === キーワード計測 ===
    send({ step: 'keywords', message: 'キーワード存在感を計測中…' });
    const allResponses = [
      ...chatgptResult.responses, ...perplexityResult.responses,
      ...googleAIResult.responses, ...geminiResult.responses,
    ].filter(Boolean);
    const updatedKeywords = measureKeywordPresences(client.keywords || [], allResponses);

    // === 競合スコア ===
    send({ step: 'competitors', message: '競合スコアを計算中…' });
    const competitorNames = (client.competitors || []).map(c => c.name).filter(Boolean);
    let updatedCompetitors = client.competitors || [];
    if (competitorNames.length > 0) {
      const competitorListings = await measureCompetitorListings(competitorNames, industry);
      updatedCompetitors = scoreCompetitorsFromResponses(
        client.competitors,
        [...competitorListings, ...allResponses]
      );
    }

    // === 引用ドメイン集計 ===
    const citations = aggregateCitationsByDomain(allResponses);

    // === スコア変化計算 ===
    const prevScore = client.current_score || 0;
    const diff = overallScore - prevScore;
    const scoreChange = diff >= 0 ? `+${diff}pt` : `${diff}pt`;

    // === エンジン別サマリー ===
    const enginesPayload = activeEngines.map(e => ({
      name: e.name === 'chatgpt' ? 'ChatGPT' :
            e.name === 'perplexity' ? 'Perplexity' :
            e.name === 'google_ai' ? 'Google AI' : 'Gemini',
      score: e.result.score,
      color: e.name === 'chatgpt' ? '#10B981' :
             e.name === 'perplexity' ? '#8B5CF6' :
             e.name === 'google_ai' ? '#F59E0B' : '#3B82F6',
      val: e.result.score,
    }));

    // === トレンドデータ更新 ===
    const trend = [...(client.trend || [])];
    const now = new Date();
    trend.push({
      month: currentMonth,
      label: `${now.getMonth() + 1}月`,
      mentions: activeEngines.reduce((s, e) => s + (e.result.mentionCount || 0), 0),
      score: overallScore,
    });
    if (trend.length > 12) trend.splice(0, trend.length - 12);

    // === DB 保存 ===
    send({ step: 'saving', message: 'データを保存中…' });

    await supabaseAdmin.from('clients').update({
      current_score: overallScore,
      score_change: scoreChange,
      engines: enginesPayload,
      keywords: updatedKeywords,
      competitors: updatedCompetitors,
      citations: citations.slice(0, 20),
      trend,
      score_alert: null, // 手動計測後はアラートをリセット
      score_alert_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', client.id);

    // ai_scores テーブルにも保存
    const scoreRows = activeEngines.map(e => ({
      client_id: client.id,
      ai_engine: e.name,
      score: e.result.score,
      mention_count: e.result.mentionCount || 0,
      total_queries: e.result.totalQueries || 0,
      week_start: weekStart,
    }));
    await supabaseAdmin.from('ai_scores')
      .upsert(scoreRows, { onConflict: 'client_id,ai_engine,week_start' });

    send({
      step: 'done',
      message: `計測完了！ ${prevScore}pt → ${overallScore}pt（${scoreChange}）`,
      result: { overallScore, scoreChange, prevScore, enginesPayload },
    });
    console.log(`[手動計測] 完了: ${client.name} ${prevScore}pt → ${overallScore}pt`);
  } catch (e) {
    console.error('[手動計測] エラー:', e);
    send({ step: 'error', message: '計測中にエラーが発生しました: ' + e.message });
  }

  res.end();
};
