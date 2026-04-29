const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOOTSTRAP_SECRET = process.env.ADMIN_BOOTSTRAP_SECRET;

async function safeJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function svc(path, options = {}) {
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
  if (!SUPABASE_URL || !SERVICE_ROLE || !BOOTSTRAP_SECRET) return res.status(500).json({ error: 'Missing env vars' });

  const { secret, email, password } = req.body || {};
  if (secret !== BOOTSTRAP_SECRET) return res.status(403).json({ error: 'Forbidden' });
  if (!email || !password) return res.status(400).json({ error: 'email/password required' });

  try {
    const createRes = await svc('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
    const createJson = await safeJson(createRes);

    if (!createRes.ok || !createJson?.id) {
      const details = createJson?.msg || createJson?.error_description || createJson?.error || createJson?.raw || 'create admin failed';
      return res.status(createRes.status || 400).json({ error: `Create admin failed: ${details}` });
    }

    const upsertRes = await svc('/rest/v1/admin_users', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ user_id: createJson.id, is_active: true })
    });
    const upsertJson = await safeJson(upsertRes);
    if (!upsertRes.ok) {
      const details = upsertJson?.message || upsertJson?.error || upsertJson?.raw || 'admin_users upsert failed';
      return res.status(upsertRes.status || 400).json({ error: `Admin role failed: ${details}` });
    }

    return res.status(200).json({ ok: true, email, user_id: createJson.id });
  } catch (error) {
    return res.status(500).json({ error: `Unexpected error: ${error.message}` });
  }
}
