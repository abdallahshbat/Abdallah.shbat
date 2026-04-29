const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOOTSTRAP_SECRET = process.env.ADMIN_BOOTSTRAP_SECRET;

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

  let userId;
  const createRes = await svc('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
  const createJson = await createRes.json();
  if (createRes.ok) {
    userId = createJson.id;
  } else {
    const listRes = await svc(`/auth/v1/admin/users?email=${encodeURIComponent(email)}`);
    const listJson = await listRes.json();
    userId = listJson?.users?.[0]?.id;
    if (!userId) return res.status(400).json({ error: createJson?.msg || 'cannot create/find user' });
  }

  await svc('/rest/v1/admin_users', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ user_id: userId, is_active: true })
  });

  return res.status(200).json({ ok: true, email, user_id: userId });
}
