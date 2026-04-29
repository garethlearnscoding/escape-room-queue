const { read } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");

const WINDOW = 5 * 60 * 1000;

module.exports = async (req, res) => {
  setCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const data = await read();
  const now = Date.now();

  return res.status(200).json({
    queue: data.queue.map((e, i) => ({
      id: e.id,
      label: e.label,
      position: i + 1,
      status: e.status,
      joinedAt: e.joinedAt,
      notifiedAt: e.notifiedAt,
      timeRemainingMs: e.notifiedAt ? Math.max(0, WINDOW - (now - e.notifiedAt)) : null,
      expired: e.notifiedAt ? (now - e.notifiedAt > WINDOW) : false,
    })),
    total: data.queue.length,
    served: data.served,
    usedTokens: data.usedTokens || [],
  });
};
