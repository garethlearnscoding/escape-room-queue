// GET /api/token  — PUBLIC
// Generates a short-lived QR token (base64 timestamp)

const { setCors, handleOptions } = require("./_cors");

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const now = Date.now();
  const token = Buffer.from(now.toString()).toString("base64");

  return res.status(200).json({
    token,
    generatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 2 * 60 * 1000).toISOString(),
  });
};
