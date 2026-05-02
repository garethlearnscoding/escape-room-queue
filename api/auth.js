const { setCors, handleOptions } = require("./_cors");

module.exports = (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username, password } = req.body || {};

  const validUser = process.env.ADMIN_USER || "jh207";
  const validPass = process.env.ADMIN_PASS || "password123";

  if (username === validUser && password === validPass) {
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: "Invalid credentials" });
};
