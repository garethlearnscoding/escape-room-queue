// GET /api/status?id=<queue_number>  — PUBLIC

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

  // Truly not found
  if (!entry) return res.status(404).json({ error: "Not in queue" });

  // Served or no-show — return 200 with status so frontend can show correct screen
  if (entry.status === "served" || entry.status === "noshow") {
    return res.status(200).json({ status: entry.status });
  }

  const active = await getActive();
  const position = active.findIndex(e => e.queue_number === entry.queue_number) + 1;
  const peopleAhead = position - 1;

  return res.status(200).json({
    id: entry.queue_number,
    queueNumber: entry.queue_number,
    label: entry.name,
    position,
    peopleAhead,
    total: active.length,
    status: entry.status,
    notifiedAt: entry.notified_at ? new Date(entry.notified_at).toISOString() : null,
  });
};
