// POST /api/auth
// Admin login — exchanges email/password for a Supabase JWT
// Frontend stores this JWT and sends it as Bearer on all admin requests

const { createClient } = require("@supabase/supabase-js");
const { setCors, handleOptions } = require("./_cors");

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }

  // Use anon key here — signIn does not need service role
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  return res.status(200).json({
    accessToken: data.session.access_token,
    expiresAt: data.session.expires_at,
  });
};
