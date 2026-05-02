const { setCors, handleOptions } = require("./_cors");

module.exports = (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  return res.status(200).json({
    apiUrl: process.env.API_URL || "http://localhost:3000",
    githubPagesUrl: process.env.GITHUB_PAGES_URL || "http://localhost:3000",
  });
};
