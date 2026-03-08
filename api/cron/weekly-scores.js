// api/cron/weekly-scores.js
// GET /api/cron/weekly-scores
// 毎週月曜日に全クライアントのAIスコアを自動計測する (Vercel Cron Job)

const supabaseAdmin = require('../../lib/supabaseAdmin');
const {
  measureWithChatGPT,
  measureWithPerplexity,
  getWeekStart,
  getCurrentMonth,
} = require('../../lib/aiMeasurement');

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
      console.log(`[計測中] ${client.name}`);

      const [chatgptResult, perplexityResult] = await Promise.all([
        measureWithChatGPT(brandNames, industry),
        measureWithPerplexity(brandNames, industry),
      ]);

      const overallScore = Math.round((chatgptResult.score + perplexityResult.score) / 2);

      // ai_scores に保存
      await supabaseAdmin.from('ai_scores').upsert([
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

      // engines 更新
      const engines = JSON.parse(JSON.stringify(client.engines || []));
      const chatgptEngine = engines.find(e => e.name === 'ChatGPT');
      const perplexityEngine = engines.find(e => e.name === 'Perplexity');
      if (chatgptEngine) chatgptEngine.val = chatgptResult.score;
      if (perplexityEngine) perplexityEngine.val = perplexityResult.score;

      // trend 更新
      const trend = JSON.parse(JSON.stringify(client.trend || []));
      const existing = trend.find(t => t.month === currentMonth);
      if (existing) {
        existing.score = overallScore;
      } else {
        trend.push({ month: currentMonth, mentions: 0, score: overallScore });
      }

      await supabaseAdmin.from('clients').update({
        current_score: overallScore,
        score_change: `${overallScore - client.current_score >= 0 ? '+' : ''}${overallScore - client.current_score}`,
        engines,
        trend: trend.slice(-6),
        updated_at: new Date().toISOString(),
      }).eq('id', client.id);

      results.push({ id: client.id, name: client.name, overallScore, status: 'success' });
      console.log(`[完了] ${client.name}: ${overallScore}pt`);

    } catch (err) {
      console.error(`[エラー] ${client.name}: ${err.message}`);
      results.push({ id: client.id, name: client.name, error: err.message, status: 'error' });
    }

    // クライアント間で1秒待機（APIレート対策）
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('[週次クロン] 計測完了:', results);
  return res.status(200).json({ success: true, weekStart, results });
};
