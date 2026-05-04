// POST /api/leave?id=<queue_number>  — PUBLIC
// User voluntarily leaves queue. Marks as served (keeps record).

const { getEntry, getActive, updateStatus } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");
const { validateId } = require("./_validate");

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let id;
  try {
    id = validateId(req.query.id);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const entry = await getEntry(id);
  if (!entry || entry.status === "served") {
    return res.status(404).json({ error: "Not found" });
  }

  const wasNotified = entry.status === "notified";

  // Soft delete — mark served to preserve record
  await updateStatus(id, "served");

  // Promote next person if the one leaving was first
  if (wasNotified) {
    const active = await getActive();
    if (active.length > 0) {
      await updateStatus(active[0].queue_number, "notified", Date.now());
    }
  }

  return res.status(200).json({ ok: true });
};
