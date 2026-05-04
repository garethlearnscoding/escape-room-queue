// POST /api/next  — ADMIN (JWT required)
// Marks current first person as served, notifies next

const { getActive, updateStatus } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");
const { requireAuth } = require("./_auth");

module.exports = requireAuth(async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const active = await getActive();

  if (active.length === 0) {
    return res.status(200).json({
      message: "Queue empty",
      served: null,
      next: null,
      remaining: 0,
    });
  }

  const current = active[0];
  await updateStatus(current.queue_number, "served");

  let next = null;
  if (active.length > 1) {
    next = active[1];
    await updateStatus(next.queue_number, "notified", Date.now());
  }

  return res.status(200).json({
    served: current.name,
    servedQueueNumber: current.queue_number,
    next: next?.name || null,
    nextQueueNumber: next?.queue_number || null,
    remaining: active.length - 1,
  });
});
