const { setCors, handleOptions } = require("./_cors");

module.exports = (req, res) => {
  setCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const now = Date.now();
  const token = Buffer.from(now.toString()).toString("base64");
  return res.status(200).json({ token, generatedAt: now, expiresAt: now + 2 * 60 * 1000 });
};
