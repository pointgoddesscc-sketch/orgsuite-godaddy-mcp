const { send, requireMcpToken } = require("../../lib/http");
const { listDomains } = require("../../lib/actions");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return send(res, 405, { ok: false, error: "GET only" });
    requireMcpToken(req);
    const data = await listDomains();
    return send(res, 200, data);
  } catch (err) {
    return send(res, err.status || 500, {
      ok: false,
      error: err.code || err.message,
      details: err.body || undefined,
    });
  }
};
