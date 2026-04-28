const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

function setCors(res, req) {
  const origin = req.headers.origin;
  // In dev, allow localhost/127.0.0.1 or the specified ALLOWED_ORIGIN or private IPs
  const isLocal = origin && (
    origin.includes("localhost") || 
    origin.includes("127.0.0.1") || 
    origin.includes("192.168.") || 
    origin.includes("172.") || 
    origin.includes("10.") ||
    origin === ALLOWED_ORIGIN
  );

  if (isLocal) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function handleOptions(req, res) {
  if (req.method === "OPTIONS") {
    setCors(res, req);
    res.status(200).end();
    return true;
  }
  return false;
}

module.exports = { setCors, handleOptions };
