// api/client.js
// GET /api/client
// ログイン中ユーザーのクライアントデータを Supabase DB から返す

const supabase = require('../lib/supabaseAdmin');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization ヘッダーがありません' });
  }

  const accessToken = authHeader.split('Bearer ')[1];

  // JWT payload を直接デコードしてメールを取得（Supabase Auth API 呼び出し不要）
  let userEmail;
  try {
    const payloadBase64 = accessToken.split('.')[1];
    // base64url → base64 変換（パディング補完）
    const padded = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const payload = JSON.parse(Buffer.from(padded + pad, 'base64').toString('utf-8'));

    // デバッグ: ペイロードのキーを出力
    console.log('[JWT] payload keys:', Object.keys(payload));
    console.log('[JWT] sub:', payload.sub, '/ email:', payload.email, '/ user_metadata:', JSON.stringify(payload.user_metadata));

    // 複数の場所からメールを取得（Supabase バージョンによって異なる）
    userEmail = payload.email
      || payload.user_metadata?.email
      || payload.identities?.[0]?.identity_data?.email;

    if (!userEmail) {
      console.log('[JWT] email not found. Full payload:', JSON.stringify(payload));
      throw new Error('email not found in token');
    }

    // トークンの有効期限チェック
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: 'トークンの有効期限が切れています' });
    }
  } catch (e) {
    return res.status(401).json({ error: 'トークンの検証に失敗しました', detail: e.message });
  }

  // Supabase DB からクライアントデータを取得
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('email', userEmail)
    .single();

  if (clientError || !client) {
    return res.status(403).json({
      error: 'このアカウントに紐づくクライアントデータが見つかりません',
      email: userEmail,
    });
  }

  // ai_scores テーブルから週次データを取得（直近10週分）
  const { data: weeklyScores } = await supabase
    .from('ai_scores')
    .select('week_start, ai_engine, score, mention_count, total_queries')
    .eq('client_id', client.id)
    .order('week_start', { ascending: true })
    .limit(60); // 最大15週 × 4エンジン

  // 週ごとにまとめて加重平均スコアを計算
  const weeklyTrend = [];
  if (weeklyScores && weeklyScores.length > 0) {
    const weeks = [...new Set(weeklyScores.map(r => r.week_start))].sort();
    const WEIGHTS = { chatgpt: 0.35, perplexity: 0.35, google_ai: 0.15, gemini: 0.15 };

    for (const week of weeks) {
      const rows = weeklyScores.filter(r => r.week_start === week);
      let weightedSum = 0, totalWeight = 0, totalMentions = 0;
      const engines = {};

      for (const row of rows) {
        const w = WEIGHTS[row.ai_engine] || 0;
        weightedSum += row.score * w;
        totalWeight += w;
        totalMentions += row.mention_count || 0;
        engines[row.ai_engine] = row.score;
      }

      const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
      // 表示用ラベル: "3/10" 形式
      const d = new Date(week);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;

      weeklyTrend.push({ week, label, score, mentions: totalMentions, engines });
    }
  }

  // ダッシュボード用フォーマットに変換
  const dashboardClient = {
    id: client.id,
    email: client.email,
    name: client.name,
    short: client.short,
    color: client.color,
    industry: client.industry,
    userName: client.user_name,
    userRole: client.user_role,
    score: client.current_score,
    scoreChange: client.score_change || '+0',
    rank: client.rank || 1,
    kpi: client.kpi || [],
    trend: client.trend || [],
    weeklyTrend,
    engines: client.engines || [],
    keywords: client.keywords || [],
    competitors: client.competitors || [],
    citations: client.citations || [],
    influencers: client.influencers || [],
    barData: client.bar_data || [],
    insight: client.insight || '',
    updatedAt: client.updated_at,
    settings: client.settings || {},
  };

  return res.status(200).json({ client: dashboardClient });
};
