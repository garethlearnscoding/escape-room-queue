// GET /api/info  — PUBLIC
// Returns basic queue stats for the instructions screen
// No auth required — intentionally minimal

const { getActive } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const active = await getActive();
    return res.status(200).json({
      total: active.length,
      estimatedWaitMins: active.length * 15,
    });
  } catch {
    return res.status(503).json({ error: "Unavailable" });
  }
};
