const { read, save } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");

module.exports = async (req, res) => {
  setCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const data = await read();
  const idx = data.queue.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  data.queue.splice(idx, 1);

  if (idx === 0 && data.queue.length > 0) {
    data.queue[0].status = "notified";
    data.queue[0].notifiedAt = Date.now();
  }

  await save(data);
  return res.status(200).json({ ok: true });
};
