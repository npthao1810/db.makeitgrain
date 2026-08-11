const isAuthRequired = () => process.env.NETLIFY === 'true' || process.env.AUTH_REQUIRED === 'true';

async function requireUser(req, res, next) {
  // Local development and automated tests can run without a Supabase session.
  // Netlify always requires a verified Supabase user.
  if (!isAuthRequired()) {
    next();
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const authorization = req.get('authorization');
  if (!supabaseUrl || !anonKey) {
    res.status(503).json({ error: 'Authentication is not configured.' });
    return;
  }
  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sign in is required.' });
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization },
    });
    if (!response.ok) {
      res.status(401).json({ error: 'Your sign-in session is invalid or expired.' });
      return;
    }
    req.user = await response.json();
    next();
  } catch {
    res.status(503).json({ error: 'Unable to verify your sign-in session.' });
  }
}

module.exports = { requireUser };
