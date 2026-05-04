// GET /api/status?id=<queue_number>  — PUBLIC
// Returns ISO notifiedAt string — client runs countdown locally after notified

const { getActive, getEntry } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");
const { validateId } = require("./_validate");

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  let id;
  try {
    id = validateId(req.query.id);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const entry = await getEntry(id);

  if (!entry || entry.status === "served" || entry.status === "noshow") {
    return res.status(404).json({ error: "Not in queue" });
  }

  const active = await getActive();
  const position = active.findIndex(e => e.queue_number === entry.queue_number) + 1;

  return res.status(200).json({
    id: entry.queue_number,
    queueNumber: entry.queue_number,
    label: entry.name,
    position,
    total: active.length,
    status: entry.status,
    // ISO string — user client caches and runs countdown locally
    notifiedAt: entry.notified_at ? new Date(entry.notified_at).toISOString() : null,
  });
};
