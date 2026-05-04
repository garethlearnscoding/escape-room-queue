// POST /api/noshow  — ADMIN (JWT required)
// Marks person as no-show (not counted as served), promotes next waiting if they were notified
// Body: { id } — queue_number

const { db, getActive, updateStatus } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");
const { requireAuth } = require("./_auth");
const { validateId } = require("./_validate");

module.exports = requireAuth(async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const rawId = req.body?.id ?? req.query?.id;
  let id;
  try {
    id = validateId(rawId);
  } catch {
    return res.status(400).json({ error: "Invalid or missing id" });
  }

  const { data: entry } = await db()
    .from("queue")
    .select("*")
    .eq("queue_number", id)
    .single();

  if (!entry || entry.status === "served" || entry.status === "noshow") {
    return res.status(404).json({ error: "Entry not found or already resolved" });
  }

  const wasNotified = entry.status === "notified";
  await updateStatus(id, "noshow");

  // If they were notified, promote next waiting person
  if (wasNotified) {
    const active = await getActive();
    const nextWaiting = active.find(e => e.status === "waiting");
    if (nextWaiting) {
      await updateStatus(nextWaiting.queue_number, "notified", Date.now());
    }
  }

  return res.status(200).json({
    removed: entry.name,
    removedQueueNumber: entry.queue_number,
  });
});
