// api/admin/update-influencers.js
// POST /api/admin/update-influencers
// インフルエンサー・キャンペーンデータを更新する（BitStar管理者のみ）

const supabase = require('../../lib/supabaseAdmin');

function checkAdmin(req) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  return token && token === process.env.ADMIN_SECRET;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!checkAdmin(req)) {
    return res.status(401).json({ error: '管理者権限がありません' });
  }

  const { clientId, influencers, barData } = req.body || {};

  if (!clientId) {
    return res.status(400).json({ error: 'clientId が必要です' });
  }

  // バリデーション
  if (!Array.isArray(influencers) || !Array.isArray(barData)) {
    return res.status(400).json({ error: 'influencers・barData は配列で指定してください' });
  }

  // 空欄の行を除外
  const cleanInfluencers = influencers.filter(inf => inf.name && inf.name.trim());
  const cleanBarData = barData.filter(bar => bar.label && bar.label.trim());

  const { error } = await supabase
    .from('clients')
    .update({
      influencers: cleanInfluencers,
      bar_data: cleanBarData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId);

  if (error) {
    console.error('[admin] 更新エラー:', error);
    return res.status(500).json({ error: '更新に失敗しました', detail: error.message });
  }

  return res.status(200).json({
    success: true,
    influencerCount: cleanInfluencers.length,
    campaignCount: cleanBarData.length,
  });
};
