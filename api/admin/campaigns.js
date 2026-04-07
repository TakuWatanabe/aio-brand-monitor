const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyToken(token) {
  if (!token) return false;
  const { data } = await supabaseAdmin
    .from('admin_sessions')
    .select('id')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();
  return !!data;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!(await verifyToken(token))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // GET: list campaigns for a client
  if (req.method === 'GET') {
    const { clientId } = req.query;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('id, name, start_date, end_date, result_baseline_score, result_final_score, result_lift, result_lift_pct, result_recorded_at, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ campaigns: data || [] });
  }

  // POST: create a new campaign
  if (req.method === 'POST') {
    const { clientId, name, start_date, end_date } = req.body;
    if (!clientId || !name) return res.status(400).json({ error: 'clientId and name required' });

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert({
        client_id: clientId,
        name: name.trim(),
        start_date: start_date || null,
        end_date: end_date || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ campaign: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
