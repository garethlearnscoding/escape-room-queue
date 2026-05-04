const { db, getActive, updateStatus } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const { data: entry } = await db()
    .from("queue")
    .select("*")
    .eq("queue_number", id)
    .single();

  if (!entry || entry.status === "served") {
    return res.status(404).json({ error: "Not found" });
  }

  const wasFirst = entry.status === "notified";

  // Mark as served (soft delete — keeps record)
  await updateStatus(entry.queue_number, "served");

  // If they were first (notified), promote the next waiting person
  if (wasFirst) {
    const active = await getActive();
    if (active.length > 0) {
      await updateStatus(active[0].queue_number, "notified", Date.now());
    }
  }

  return res.status(200).json({ ok: true });
};K