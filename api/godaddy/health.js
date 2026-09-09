const { send, publicHealthAllowed } = require("../../lib/http");
const { healthPayload } = require("../../lib/actions");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { ok: false, error: "GET only" });
  const payload = healthPayload();
  if (!publicHealthAllowed() && payload.status === "configured") {
    return send(res, 200, { ok: true, status: "configured", domain: payload.domain });
  }
  const status = payload.status === "keys_missing" ? 503 : 200;
  return send(res, status, payload);
};
