const { read, save } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");

module.exports = async (req, res) => {
  setCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const data = await read();

  if (data.queue.length === 0) {
    return res.status(200).json({ message: "Queue empty" });
  }

  // Notify the first person in line
  data.queue[0].status = "notified";
  data.queue[0].notifiedAt = Date.now();

  await save(data);

  return res.status(200).json({
    called: data.queue[0].label,
    status: "notified"
  });
};
