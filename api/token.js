module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();

  const token = Buffer.from(Date.now().toString()).toString("base64");
  return res.status(200).json({ token, generatedAt: Date.now() });
};
