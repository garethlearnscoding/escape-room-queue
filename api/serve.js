const { read, save } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");

module.exports = async (req, res) => {
  setCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const data = await read();
  const { id } = req.body || {};

  if (data.queue.length === 0) {
    return res.status(200).json({ message: "Queue empty" });
  }

  let index = 0;
  if (id) {
    index = data.queue.findIndex(e => e.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "User not found in queue" });
    }
  }

  const served = data.queue.splice(index, 1)[0];
  data.served += 1;

  await save(data);

  return res.status(200).json({
    served: served.label,
    next: data.queue[0]?.label || null,
    remaining: data.queue.length,
  });
};
