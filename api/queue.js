const { read } = require("./_queue");

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();

  const data = read();
  return res.status(200).json({
    queue: data.queue.map((e, i) => ({ ...e, position: i + 1 })),
    total: data.queue.length,
    served: data.served,
  });
};
