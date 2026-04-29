const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function safeJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function supabaseFetch(path, options = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_ROLE) return res.status(500).json({ error: 'Missing server env keys' });

  try {
    const authHeader = req.headers.authorization || '';
    const userToken = authHeader.replace('Bearer ', '').trim();
    if (!userToken) return res.status(401).json({ error: 'Missing auth token' });

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: process.env.SUPABASE_ANON_KEY || '', Authorization: `Bearer ${userToken}` }
    });
    const adminUser = await safeJson(userRes);
    if (!userRes.ok || !adminUser?.id) return res.status(401).json({ error: 'Invalid session token' });

    const adminCheck = await supabaseFetch(`/rest/v1/admin_users?user_id=eq.${adminUser.id}&is_active=eq.true&select=id`);
    const adminRows = await safeJson(adminCheck);
    if (!adminCheck.ok || !Array.isArray(adminRows) || adminRows.length === 0) return res.status(403).json({ error: 'Not allowed' });

    const { email, password, brand_id } = req.body || {};
    if (!email || !password || !brand_id) return res.status(400).json({ error: 'email, password, brand_id required' });

    const createUserRes = await supabaseFetch('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true })
    });
    const createdUser = await safeJson(createUserRes);
    if (!createUserRes.ok || !createdUser?.id) {
      const details = createdUser?.msg || createdUser?.error_description || createdUser?.error || createdUser?.raw || 'Failed creating user';
      return res.status(createUserRes.status || 400).json({ error: details });
    }

    const linkRes = await supabaseFetch('/rest/v1/brand_users', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ brand_id, user_id: createdUser.id, is_active: true })
    });
    const linkJson = await safeJson(linkRes);
    if (!linkRes.ok) return res.status(linkRes.status || 400).json({ error: linkJson?.message || linkJson?.error || 'User created but brand link failed' });

    return res.status(200).json({ ok: true, user_id: createdUser.id });
  } catch (e) {
    return res.status(500).json({ error: `Unexpected server error: ${e.message}` });
  }
}
