const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "*")
  .split(",")
  .map(o => o.trim());

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PATCH,DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function handleOptions(req, res) {
  if (req.method === "OPTIONS") {
    setCors(req, res);
    res.status(200).end();
    return true;
  }
  return false;
}

module.exports = { setCors, handleOptions };
