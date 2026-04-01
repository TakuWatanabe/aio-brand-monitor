// api/client.js
// GET  /api/client              — ログイン中ユーザーのクライアントデータを返す
// GET  /api/client?action=settings — 通知設定を取得
// POST /api/client?action=settings — 通知設定を保存
// POST /api/client?action=profile  — プロフィール（表示名・役職・カラー）を更新
// ※ /api/settings, /api/profile は vercel.json のrewriteでここへ転送される

const supabase = require('../lib/supabaseAdmin');
const { createClient } = require('@supabase/supabase-js');

// ── JWT デコードヘルパー ──────────────────────────────────────────────
function decodeToken(token) {
  const payloadBase64 = token.split('.')[1];
  const padded = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const payload = JSON.parse(Buffer.from(padded + pad, 'base64').toString('utf-8'));
  const userEmail = payload.email
    || payload.user_metadata?.email
    || payload.identities?.[0]?.identity_data?.email;
  if (!userEmail) throw new Error('email not found in token');
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw Object.assign(new Error('トークンの有効期限が切れています'), { status: 401 });
  }
  return { userEmail, payload };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── 認証 ────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization ヘッダーがありません' });
  }
  const accessToken = authHeader.split('Bearer ')[1];

  let userEmail;
  try {
    ({ userEmail } = decodeToken(accessToken));
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message || 'トークンの検証に失敗しました' });
  }

  const action = req.query.action;

  // ══════════════════════════════════════════════════════════════════
  // POST /api/client?action=profile  （/api/profile から転送）
  // ══════════════════════════════════════════════════════════════════
  if (req.method === 'POST' && action === 'profile') {
    const { data: client, error: clientError } = await supabase
      .from('clients').select('id').eq('email', userEmail).single();
    if (clientError || !client) return res.status(404).json({ error: 'クライアントが見つかりません' });

    const { user_name, user_role, color } = req.body || {};
    if (!user_name || typeof user_name !== 'string' || user_name.trim() === '') {
      return res.status(400).json({ error: '表示名（user_name）は必須です' });
    }
    const validColor = color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : undefined;
    const updatePayload = {
      user_name: user_name.trim(),
      user_role: (user_role || '').trim(),
      short: user_name.trim().charAt(0),
      updated_at: new Date().toISOString(),
    };
    if (validColor) updatePayload.color = validColor;

    const { error: updateError } = await supabase.from('clients').update(updatePayload).eq('id', client.id);
    if (updateError) {
      console.error('[profile] 更新エラー:', updateError);
      return res.status(500).json({ error: 'プロフィールの更新に失敗しました' });
    }
    console.log(`[profile] ${userEmail}: プロフィールを更新しました`);
    return res.status(200).json({ success: true, ...updatePayload });
  }

  // ══════════════════════════════════════════════════════════════════
  // GET  /api/client?action=settings  （/api/settings GET から転送）
  // POST /api/client?action=settings  （/api/settings POST から転送）
  // ══════════════════════════════════════════════════════════════════
  if (action === 'settings') {
    const { data: client, error: clientError } = await supabase
      .from('clients').select('id, settings').eq('email', userEmail).single();
    if (clientError || !client) return res.status(404).json({ error: 'クライアントが見つかりません' });

    if (req.method === 'GET') {
      return res.status(200).json({ settings: client.settings || {} });
    }

    if (req.method === 'POST') {
      const { settings } = req.body || {};
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'settings オブジェクトが必要です' });
      }
      const sanitized = {
        alertEmail:     settings.alertEmail === false ? false : true,
        weeklyEmail:    settings.weeklyEmail === false ? false : true,
        alertThreshold: Math.min(30, Math.max(5, parseInt(settings.alertThreshold, 10) || 10)),
        measureFreq:    ['daily', 'weekly'].includes(settings.measureFreq) ? settings.measureFreq : 'daily',
      };
      const { error: updateError } = await supabase
        .from('clients').update({ settings: sanitized, updated_at: new Date().toISOString() }).eq('id', client.id);
      if (updateError) {
        console.error('[settings] 更新エラー:', updateError);
        return res.status(500).json({ error: '設定の保存に失敗しました' });
      }
      console.log(`[settings] ${userEmail}: 設定を更新しました`, sanitized);
      return res.status(200).json({ success: true, settings: sanitized });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ══════════════════════════════════════════════════════════════════
  // GET /api/client  — クライアントデータ取得（既存ロジック）
  // ══════════════════════════════════════════════════════════════════
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  console.log('[JWT] userEmail:', userEmail);

  const { data: client, error: clientError } = await supabase
    .from('clients').select('*').eq('email', userEmail).single();

  if (clientError || !client) {
    return res.status(403).json({
      error: 'このアカウントに紐づくクライアントデータが見つかりません',
      email: userEmail,
    });
  }

  // ai_scores テーブルから週次データを取得
  const { data: weeklyScores } = await supabase
    .from('ai_scores')
    .select('week_start, ai_engine, score, mention_count, total_queries')
    .eq('client_id', client.id)
    .order('week_start', { ascending: true })
    .limit(60);

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
      const d = new Date(week);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      weeklyTrend.push({ week, label, score, mentions: totalMentions, engines });
    }
  }

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
