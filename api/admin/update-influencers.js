// api/admin/update-influencers.js
// POST /api/admin/update-influencers
// インフルエンサー・キャンペーンデータを更新する（BitStar管理者のみ）

const supabaseAdmin = require('../../lib/supabaseAdmin');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // === 管理者JWT認証（ADMIN_EMAILS 環境変数で管理）===
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return res.status(401).json({ error: '認証に失敗しました' });
  }

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!adminEmails.includes(user.email.toLowerCase())) {
    return res.status(403).json({ error: '管理者権限が必要です' });
  }

  // === リクエストボディ ===
  const { clientId, influencers, barData } = req.body || {};

  if (!clientId) {
    return res.status(400).json({ error: 'clientId が必要です' });
  }
  if (!Array.isArray(influencers) || !Array.isArray(barData)) {
    return res.status(400).json({ error: 'influencers・barData は配列で指定してください' });
  }

  // 空欄の行を除外
  const cleanInfluencers = influencers.filter(inf => inf.name && inf.name.trim());
  const cleanBarData = barData.filter(bar => bar.label && bar.label.trim());

  const { error } = await supabaseAdmin
    .from('clients')
    .update({
      influencers: cleanInfluencers,
      bar_data: cleanBarData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId);

  // === influencers テーブルへ同期 ===
  try {
    if (cleanInfluencers && cleanInfluencers.length > 0) {
      const infUpserts = cleanInfluencers.map(inf => ({
        client_id: clientId,
        name: inf.name || null,
        sns_handle: inf.handle || inf.sns_handle || null,
        geo_platform: inf.geo_platform || null,
        followers: inf.followers || null,
        category: inf.category || null,
        geo_score: inf.geo_score != null ? +inf.geo_score : null,
        geo_scored_at: inf.geo_scored_at || null,
      }));
      await supabaseAdmin
        .from('influencers')
        .upsert(infUpserts, { onConflict: 'client_id,sns_handle' });
    }
  } catch (infSyncErr) {
    console.error('[update-influencers] influencers table sync error:', infSyncErr.message);
  }

  if (error) {
    console.error('[update-influencers] 更新エラー:', error);
    return res.status(500).json({ error: '更新に失敗しました', detail: error.message });
  }

  console.log(`[update-influencers] ${user.email}: clientId=${clientId} 更新完了 (influencers:${cleanInfluencers.length}, barData:${cleanBarData.length})`);
  return res.status(200).json({
    success: true,
    influencerCount: cleanInfluencers.length,
    campaignCount: cleanBarData.length,
  });
};
