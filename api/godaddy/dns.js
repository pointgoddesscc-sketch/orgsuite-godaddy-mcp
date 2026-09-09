const { send, query, readJson, requireMcpToken } = require("../../lib/http");
const { getDns, upsertDns } = require("../../lib/actions");
const { PRIMARY } = require("../../lib/godaddy");

module.exports = async function handler(req, res) {
  try {
    requireMcpToken(req);
    if (req.method === "GET") {
      const q = query(req);
      const data = await getDns(q.name || q.domain || PRIMARY, q.type, q.host || q.recordName);
      return send(res, 200, data);
    }
    if (req.method === "PUT" || req.method === "POST") {
      const body = await readJson(req);
      const data = await upsertDns({
        domain: body.domain || PRIMARY,
        type: body.type,
        name: body.name || "@",
        records: body.records,
        apply: body.apply === true,
      });
      return send(res, 200, data);
    }
    return send(res, 405, { ok: false, error: "GET or PUT/POST" });
  } catch (err) {
    return send(res, err.status || 500, {
      ok: false,
      error: err.code || err.message,
      details: err.body || undefined,
    });
  }
};
