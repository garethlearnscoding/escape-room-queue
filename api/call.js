// POST /api/call  — ADMIN (JWT required)
// Notifies the first waiting person in queue — "Call to booth"

const { db, getActive, updateStatus } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");
const { requireAuth } = require("./_auth");

module.exports = requireAuth(async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const active = await getActive();
  const waiting = active.filter(e => e.status === "waiting");

  if (waiting.length === 0) {
    const notified = active.filter(e => e.status === "notified");
    if (notified.length > 0) {
      return res.status(400).json({ error: "Someone is already being called." });
    }
    return res.status(200).json({ message: "No one waiting", called: null });
  }

  const next = waiting[0];
  await updateStatus(next.queue_number, "notified", Date.now());

  return res.status(200).json({
    called: next.name,
    calledQueueNumber: next.queue_number,
  });
});
