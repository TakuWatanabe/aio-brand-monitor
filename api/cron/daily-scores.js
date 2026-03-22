// api/cron/daily-scores.js
// GET /api/cron/daily-scores
// 毎日 22:00 JST（13:00 UTC）に全クライアントのAIスコアを自動計測し、急変アラートを検知する
// vercel.json: { "path": "/api/cron/daily-scores", "schedule": "0 13 * * *" }
// ※ 週次クロン（weekly-scores）と役割分担：
//    日次 = 素早いスコア変動検知（ChatGPT + Perplexity のみ）
//    週次 = 全エンジン計測 + メールレポート送信

const supabaseAdmin = require('../../lib/supabaseAdmin');
const {
  measureWithChatGPT,
  measureWithPerplexity,
  getWeekStart,
  getCurrentMonth,
} = require('../../lib/aiMeasurement');

// スコア急変の閾値（ptポイント）
const ALERT_THRESHOLD = 10;

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') return res.status(405).end();

  console.log('[日次クロン] 全クライアントのスコア急変チェックを開始');

  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select('id, name, brand_names, brand_name, industry, engines, current_score, kpi, trend, keywords, competitors');

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
      console.log(`[日次計測中] ${client.name}`);

      // 日次は ChatGPT + Perplexity のみ（API消費を抑制）
      const [chatgptResult, perplexityResult] = await Promise.all([
        measureWithChatGPT(brandNames, industry),
        measureWithPerplexity(brandNames, industry),
      ]);

      // 有効エンジンの平均スコア（日次簡易計算）
      const scores = [chatgptResult.score, perplexityResult.score];
      const dailyScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

      const prevScore = client.current_score || 0;
      const diff = dailyScore - prevScore;
      const isAlert = Math.abs(diff) >= ALERT_THRESHOLD;

      console.log(`[日次] ${client.name}: ${prevScore}pt → ${dailyScore}pt (${diff >= 0 ? '+' : ''}${diff}pt)${isAlert ? ' ⚠️ 急変アラート' : ''}`);

      // スコア急変の場合は clients テーブルのフラグを更新
      if (isAlert) {
        const alertLabel = diff > 0 ? `▲ +${diff}pt 急上昇中` : `▼ ${diff}pt 急落中`;
        await supabaseAdmin.from('clients').update({
          score_alert: alertLabel,
          score_alert_at: new Date().toISOString(),
        }).eq('id', client.id);
        console.log(`[アラート] ${client.name}: ${alertLabel}`);
      }

      // ai_scores に日次スコアを保存（日次エンジン識別用サフィックス付き）
      await supabaseAdmin.from('ai_scores').upsert([
        {
          client_id: client.id,
          ai_engine: 'chatgpt_daily',
          score: chatgptResult.score,
          mention_count: chatgptResult.mentionCount,
          total_queries: chatgptResult.totalQueries,
          week_start: weekStart,
        },
        {
          client_id: client.id,
          ai_engine: 'perplexity_daily',
          score: perplexityResult.score,
          mention_count: perplexityResult.mentionCount,
          total_queries: perplexityResult.totalQueries,
          week_start: weekStart,
        },
      ], { onConflict: 'client_id,ai_engine,week_start' });

      results.push({
        id: client.id,
        name: client.name,
        prevScore,
        dailyScore,
        diff,
        alert: isAlert,
        status: 'success',
      });

    } catch (err) {
      console.error(`[日次エラー] ${client.name}: ${err.message}`);
      results.push({ id: client.id, name: client.name, error: err.message, status: 'error' });
    }

    // クライアント間で500ms待機
    await new Promise(r => setTimeout(r, 500));
  }

  const alerts = results.filter(r => r.alert);
  console.log(`[日次クロン] 完了: ${results.length}社計測 / ${alerts.length}社急変アラート`);
  return res.status(200).json({ success: true, date: new Date().toISOString(), results });
};
