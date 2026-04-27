const { read, save } = require("./_queue");

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const data = read();
  const idx = data.queue.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  data.queue.splice(idx, 1);

  // If removed person was first, notify new first
  if (idx === 0 && data.queue.length > 0) {
    data.queue[0].status = "notified";
    data.queue[0].notifiedAt = Date.now();
  }

  save(data);
  return res.status(200).json({ ok: true });
};
