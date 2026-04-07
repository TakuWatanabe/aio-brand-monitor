// api/cron/daily-scores.js
// GET /api/cron/daily-scores
// Runs daily at 13:00 UTC (22:00 JST) to measure AIO scores for all clients
// vercel.json: { "path": "/api/cron/daily-scores", "schedule": "0 13 * * *" }

const supabaseAdmin = require('../../lib/supabaseAdmin');
const {
  measureWithChatGPT,
  measureWithPerplexity,
  getWeekStart,
  getCurrentMonth,
} = require('../../lib/aiMeasurement');
const { sendAlertEmail } = require('../../lib/emailReport');
const { runCampaignTracker } = require('../../lib/campaignTracker');

const ALERT_THRESHOLD = 10;

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== ('Bearer ' + process.env.CRON_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'GET') return res.status(405).end();

  console.log('[Daily Cron] Starting AIO score measurement for all clients');

  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select('id, name, email, brand_names, brand_name, industry, engines, current_score, kpi, trend, keywords, competitors, settings');

  if (error || !clients) {
    return res.status(500).json({ error: 'Failed to fetch clients' });
  }

  const weekStart = getWeekStart();
  const currentMonth = getCurrentMonth();
  const results = [];

  for (const client of clients) {
    const brandNames = client.brand_names || [client.brand_name || client.name];
    const industry = client.industry || 'food';
    try {
      console.log('[Daily] Measuring: ' + client.name);

      const [chatgptResult, perplexityResult] = await Promise.all([
        measureWithChatGPT(brandNames, industry),
        measureWithPerplexity(brandNames, industry),
      ]);

      const scores = [chatgptResult.score, perplexityResult.score];
      const dailyScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const prevScore = client.current_score || 0;
      const diff = dailyScore - prevScore;
      const threshold = (client.settings && client.settings.alertThreshold) || ALERT_THRESHOLD;
      const isAlert = Math.abs(diff) >= threshold;

      console.log('[Daily] ' + client.name + ': ' + prevScore + 'pt -> ' + dailyScore + 'pt (' + (diff >= 0 ? '+' : '') + diff + 'pt)' + (isAlert ? ' ALERT' : ''));

      if (isAlert) {
        const alertLabel = diff > 0 ? ('UP +' + diff + 'pt') : ('DOWN ' + diff + 'pt');
        await supabaseAdmin.from('clients').update({
          score_alert: alertLabel,
          score_alert_at: new Date().toISOString(),
        }).eq('id', client.id);

        const alertEmailEnabled = !client.settings || client.settings.alertEmail !== false;
        if (client.email && alertEmailEnabled) {
          const emailResult = await sendAlertEmail({
            to: client.email,
            clientName: client.name,
            prevScore,
            newScore: dailyScore,
            alertLabel,
          });
          console.log('[AlertMail] ' + client.name + ': ' + (emailResult.ok ? 'sent' : 'skip (' + emailResult.error + ')'));
        }
      }

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
      console.error('[Daily Error] ' + client.name + ': ' + err.message);
      results.push({ id: client.id, name: client.name, error: err.message, status: 'error' });
    }
    await new Promise(r => setTimeout(r, 500));
  }

  const alerts = results.filter(r => r.alert);

  // Phase 3: Campaign lifecycle tracker
  const latestScores = {};
  for (const r of results) {
    if (r.status === 'success') {
      latestScores[r.id] = {
        aio_score: r.dailyScore,
        chatgpt_score: null,
        perplexity_score: null,
      };
    }
  }
  try {
    await runCampaignTracker(latestScores);
  } catch (e) {
    console.error('[CampaignTracker]', e.message);
  }

  console.log('[Daily Cron] Done: ' + results.length + ' clients / ' + alerts.length + ' alerts');
  return res.status(200).json({ success: true, date: new Date().toISOString(), results });
};
