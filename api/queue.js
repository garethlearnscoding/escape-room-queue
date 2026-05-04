// GET /api/queue  — ADMIN (JWT required)

const { getActive, getServedCount, getUsedTokens } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");
const { requireAuth } = require("./_auth");

const WINDOW = 5 * 60 * 1000;

module.exports = requireAuth(async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const [active, served, usedTokens] = await Promise.all([
    getActive(),
    getServedCount(),
    getUsedTokens(),
  ]);

  const now = Date.now();

  return res.status(200).json({
    queue: active.map((e, i) => {
      const notifiedMs = e.notified_at ? e.notified_at : null;
      const expired = notifiedMs ? (now - notifiedMs) > WINDOW : false;
      return {
        id: e.queue_number,
        queueNumber: e.queue_number,
        label: e.name,
        position: i + 1,
        status: e.status,
        joinedAt: e.joined_at,       // ms timestamp — consistent for admin
        notifiedAt: notifiedMs,      // ms timestamp — admin calculates countdown
        expired,
      };
    }),
    total: active.length,
    served,
    usedTokens,
  });
});
