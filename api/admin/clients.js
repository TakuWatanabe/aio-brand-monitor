// api/admin/clients.js
// GET   /api/admin/clients        → 全クライアント一覧（管理者専用）
// GET   /api/admin/clients?id=XX  → 特定クライアント詳細
// POST  /api/admin/clients        → 新規クライアント作成
// PATCH /api/admin/clients?id=XX  → クライアント情報更新
//
// 管理者判定: ADMIN_EMAILS 環境変数にカンマ区切りで設定（例: admin@example.com,ops@example.com）

const supabaseAdmin = require('../../lib/supabaseAdmin');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // === 認証（JWT） ===
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

  // === 管理者チェック ===
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!adminEmails.includes(user.email.toLowerCase())) {
    return res.status(403).json({ error: '管理者権限が必要です' });
  }

  // ============================================================
  // GET: クライアント一覧 or 単一クライアント詳細
  // ============================================================
  if (req.method === 'GET') {
    const { id } = req.query;

    if (id) {
      const { data: client, error } = await supabaseAdmin
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !client) return res.status(404).json({ error: 'クライアントが見つかりません' });
      return res.status(200).json({ client });
    }

    // 全クライアント一覧
    const { data: clients, error } = await supabaseAdmin
      .from('clients')
      .select('id, name, email, industry, current_score, score_change, updated_at, competitors, score_alert, engines')
      .order('name', { ascending: true });

    if (error) {
      console.error('[admin/clients] 取得エラー:', error);
      return res.status(500).json({ error: 'クライアント一覧の取得に失敗しました' });
    }

    const summary = (clients || []).map(c => {
      const competitors = c.competitors || [];
      const sorted = [...competitors].sort((a, b) => b.score - a.score);
      const selfEntry = sorted.find(x => x.self);
      const competitorRank = selfEntry ? sorted.indexOf(selfEntry) + 1 : null;

      return {
        id: c.id,
        name: c.name || '（未設定）',
        email: c.email || '',
        industry: c.industry || '',
        score: c.current_score || 0,
        scoreChange: c.score_change || '±0pt',
        updatedAt: c.updated_at,
        competitorRank,
        totalCompetitors: competitors.length,
        hasAlert: !!c.score_alert,
        alertMessage: c.score_alert || null,
        engines: c.engines || [],
      };
    });

    return res.status(200).json({ clients: summary, total: summary.length });
  }

  // ============================================================
  // POST: 新規クライアント作成
  // ============================================================
  if (req.method === 'POST') {
    const { name, email, industry, brand_names, competitors, keywords } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'name と email は必須です' });
    }

    // 重複チェック
    const { data: existing } = await supabaseAdmin
      .from('clients').select('id').eq('email', email.trim().toLowerCase()).single();
    if (existing) {
      return res.status(409).json({ error: 'このメールアドレスはすでに登録されています' });
    }

    const newClient = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      industry: industry || '',
      brand_names: Array.isArray(brand_names) ? brand_names : [name.trim()],
      competitors: Array.isArray(competitors) ? competitors : [],
      keywords: Array.isArray(keywords) ? keywords : [],
      current_score: 0,
      score_change: '±0pt',
      engines: [],
      trend: [],
      updated_at: new Date().toISOString(),
    };

    const { data: created, error: createError } = await supabaseAdmin
      .from('clients')
      .insert(newClient)
      .select()
      .single();

    if (createError) {
      console.error('[admin/clients] 作成エラー:', createError);
      return res.status(500).json({ error: 'クライアントの作成に失敗しました' });
    }

    console.log(`[admin/clients] 新規クライアント作成: ${email}`);
    return res.status(201).json({ client: created });
  }

  // ============================================================
  // PATCH: クライアント情報更新
  // ============================================================
  if (req.method === 'PATCH') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id が必要です' });

    const allowedFields = ['name', 'industry', 'brand_names', 'competitors', 'keywords',
                           'current_score', 'score_change', 'engines', 'trend', 'score_alert'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[admin/clients] 更新エラー:', updateError);
      return res.status(500).json({ error: 'クライアントの更新に失敗しました' });
    }

    console.log(`[admin/clients] クライアント更新: id=${id}`);
    return res.status(200).json({ client: updated });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
