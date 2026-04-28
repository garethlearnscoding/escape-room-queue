const { read } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");

const WINDOW = 5 * 60 * 1000;

module.exports = async (req, res) => {
  setCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const data = await read();
  const idx = data.queue.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not in queue" });

  const entry = data.queue[idx];
  const now = Date.now();
  const timeRemainingMs = entry.notifiedAt
    ? Math.max(0, WINDOW - (now - entry.notifiedAt))
    : null;

  return res.status(200).json({
    id: entry.id,
    label: entry.label,
    position: idx + 1,
    total: data.queue.length,
    status: entry.status,
    notifiedAt: entry.notifiedAt,
    timeRemainingMs,
    expired: entry.notifiedAt ? (now - entry.notifiedAt > WINDOW) : false,
  });
};
