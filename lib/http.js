function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-OrgSuite-Service", "godaddy-mcp");
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function query(req) {
  const url = new URL(req.url, "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}

function bearerOrHeader(req) {
  const auth = req.headers.authorization || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return (
    req.headers["x-orgsuite-token"] ||
    req.headers["x-mcp-token"] ||
    ""
  ).toString();
}

function requireMcpToken(req) {
  const expected = process.env.ORGSUITE_MCP_TOKEN;
  if (!expected) {
    const err = new Error("ORGSUITE_MCP_TOKEN is not set");
    err.status = 503;
    err.code = "mcp_token_missing";
    throw err;
  }
  const got = bearerOrHeader(req);
  if (!got || got !== expected) {
    const err = new Error("Unauthorized");
    err.status = 401;
    err.code = "unauthorized";
    throw err;
  }
}

function publicHealthAllowed() {
  return String(process.env.ALLOW_PUBLIC_HEALTH || "true").toLowerCase() !== "false";
}

module.exports = {
  send,
  readJson,
  query,
  requireMcpToken,
  publicHealthAllowed,
};
