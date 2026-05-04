// GET /api/config  — PUBLIC
// Exposes non-sensitive env vars to the admin frontend

const { setCors, handleOptions } = require("./_cors");

module.exports = (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  return res.status(200).json({
    apiUrl: process.env.API_URL || "",
    githubPagesUrl: process.env.GITHUB_PAGES_URL || "",
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  });
};
