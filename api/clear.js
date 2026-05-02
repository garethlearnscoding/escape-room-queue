const { save } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  setCors(res, req);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await save({ queue: [], served: 0, usedTokens: [] });
  return res.status(200).json({ cleared: true });
};
