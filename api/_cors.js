function setCors(req, res) {
  const origin = req.headers.origin;
  const ALLOWED_ORIGIN = "https://client.njcfuntasia.com";
  
  // If the request origin matches our allowed origin, or it's a browser check
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
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
