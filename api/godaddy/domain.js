const { send, query, requireMcpToken } = require("../../lib/http");
const { getDomain } = require("../../lib/actions");
const { PRIMARY } = require("../../lib/godaddy");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return send(res, 405, { ok: false, error: "GET only" });
    requireMcpToken(req);
    const q = query(req);
    const data = await getDomain(q.name || q.domain || PRIMARY);
    return send(res, 200, data);
  } catch (err) {
    return send(res, err.status || 500, {
      ok: false,
      error: err.code || err.message,
      details: err.body || undefined,
    });
  }
};
