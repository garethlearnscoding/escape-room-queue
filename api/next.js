const { read, save } = require("./_queue");

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const data = read();

  if (data.queue.length === 0) {
    return res.status(200).json({ message: "Queue empty", queue: [] });
  }

  const served = data.queue.shift();
  data.served += 1;

  if (data.queue.length > 0) {
    data.queue[0].status = "notified";
    data.queue[0].notifiedAt = Date.now();
  }

  save(data);

  return res.status(200).json({
    served: served.label,
    next: data.queue[0]?.label || null,
    remaining: data.queue.length,
  });
};
