// api/admin/clients.js
// GET /api/admin/clients       → クライアント一覧
// GET /api/admin/clients?id=xx → クライアント詳細

const supabase = require('../../lib/supabaseAdmin');

function checkAdmin(req) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  return token && token === process.env.ADMIN_SECRET;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  if (!checkAdmin(req)) {
    return res.status(401).json({ error: '管理者権限がありません' });
  }

  const { id } = req.query;

  if (id) {
    // 特定クライアントの詳細を返す
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, email, brand_name, industry, influencers, bar_data, current_score')
      .eq('id', id)
      .single();

    if (error || !client) {
      return res.status(404).json({ error: 'クライアントが見つかりません' });
    }

    return res.status(200).json({ client });
  }

  // 全クライアント一覧（IDと名前のみ）
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, email, industry, current_score')
    .order('name');

  if (error) {
    return res.status(500).json({ error: 'データ取得に失敗しました' });
  }

  return res.status(200).json({ clients: clients || [] });
};
