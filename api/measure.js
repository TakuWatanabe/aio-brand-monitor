// api/measure.js
// POST /api/measure
// ログイン中クライアントのAIスコアをリアルタイムで計測し、Supabaseに保存する

const supabaseAdmin = require('../lib/supabaseAdmin');
const { createClient } = require('@supabase/supabase-js');
const {
  measureWithChatGPT,
  measureWithPerplexity,
  getWeekStart,
  getCurrentMonth,
} = require('../lib/aiMeasurement');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // === 認証チェック（ANON_KEY でユーザートークンを検証）===
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return res.status(401).json({ error: 'トークンが無効です' });

  // === クライアント情報をDBから取得 ===
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('email', user.email)
    .single();

  if (clientError || !client) {
    return res.status(404).json({ error: 'クライアントが見つかりません' });
  }

  const brandNames = client.brand_names || [client.brand_name || client.name];
  const industry = client.industry || '食品・調味料';
  const weekStart = getWeekStart();

  try {
    console.log(`[計測開始] ${client.name} / ${industry} / brandNames: ${brandNames.join(', ')}`);

    // === ChatGPT + Perplexity を並列で計測 ===
    const [chatgptResult, perplexityResult] = await Promise.all([
      measureWithChatGPT(brandNames, industry),
      measureWithPerplexity(brandNames, industry),
    ]);

    console.log(`[計測完了] ChatGPT: ${chatgptResult.score}pt / Perplexity: ${perplexityResult.score}pt`);

    // === 総合スコアを計算（ChatGPT 50% + Perplexity 50%）===
    const overallScore = Math.round((chatgptResult.score + perplexityResult.score) / 2);

    // === ai_scores テーブルに保存（同週は上書き）===
    const { error: insertError } = await supabaseAdmin.from('ai_scores').upsert([
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
    ], { onConflict: 'client_id,ai_engine,week_start' });

    if (insertError) console.error('[DB] ai_scores 保存エラー:', insertError);

    // === engines データを更新 ===
    const engines = JSON.parse(JSON.stringify(client.engines || []));
    const chatgptEngine = engines.find(e => e.name === 'ChatGPT');
    const perplexityEngine = engines.find(e => e.name === 'Perplexity');
    if (chatgptEngine) chatgptEngine.val = chatgptResult.score;
    if (perplexityEngine) perplexityEngine.val = perplexityResult.score;

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

    // === clients テーブルを更新 ===
    const { error: updateError } = await supabaseAdmin.from('clients').update({
      current_score: overallScore,
      score_change: `${overallScore - client.current_score >= 0 ? '+' : ''}${overallScore - client.current_score}`,
      engines,
      trend: recentTrend,
      kpi,
      updated_at: new Date().toISOString(),
    }).eq('id', client.id);

    if (updateError) console.error('[DB] clients 更新エラー:', updateError);

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
    });
  } catch (err) {
    console.error('[計測エラー]', err);
    return res.status(500).json({ error: '計測に失敗しました', detail: err.message });
  }
};
