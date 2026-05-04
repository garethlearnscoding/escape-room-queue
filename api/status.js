const { db, getActive } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const { data: entry } = await db()
    .from("queue")
    .select("*")
    .eq("queue_number", id)
    .single();

  if (!entry || entry.status === "served") {
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
    // Send notifiedAt as ISO string once — client handles countdown locally
    notifiedAt: entry.notified_at ? new Date(entry.notified_at).toISOString() : null,
  });
};