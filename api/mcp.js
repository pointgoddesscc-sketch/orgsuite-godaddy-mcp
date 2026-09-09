const { send, readJson, requireMcpToken } = require("../lib/http");
const {
  listDomains,
  getDomain,
  getDns,
  upsertDns,
  setAutoRenew,
  planMicrosoft365Dns,
  planSslDns,
  healthPayload,
} = require("../lib/actions");
const { PRIMARY } = require("../lib/godaddy");

const TOOLS = [
  { name: "health", description: "Sanitized credential status. No secrets." },
  { name: "list_domains", description: "List account domains and expiration dates." },
  { name: "get_domain", description: "Expiration, lock, auto-renew, nameservers." },
  { name: "get_dns", description: "Read DNS records." },
  { name: "set_auto_renew", description: "Preview or set renewAuto. apply=true required to write." },
  { name: "upsert_dns", description: "Preview or replace one DNS name/type. apply=true required to write." },
  { name: "plan_microsoft_365_dns", description: "Microsoft 365 DNS plan. No write." },
  { name: "plan_ssl_dns", description: "SSL validation DNS plan. No write." },
];

async function callTool(name, args = {}) {
  switch (name) {
    case "health":
      return healthPayload();
    case "list_domains":
      return listDomains();
    case "get_domain":
      return getDomain(args.domain || PRIMARY);
    case "get_dns":
      return getDns(args.domain || PRIMARY, args.type, args.host);
    case "set_auto_renew":
      return setAutoRenew({ domain: args.domain, renewAuto: args.renewAuto, apply: args.apply === true });
    case "upsert_dns":
      return upsertDns({
        domain: args.domain,
        type: args.type,
        name: args.name,
        records: args.records,
        apply: args.apply === true,
      });
    case "plan_microsoft_365_dns":
      return planMicrosoft365Dns(args.domain || PRIMARY);
    case "plan_ssl_dns":
      return planSslDns(args.domain || PRIMARY, args);
    default: {
      const err = new Error("Unknown tool: " + name);
      err.status = 404;
      throw err;
    }
  }
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return send(res, 200, {
        ok: true,
        name: "orgsuite-godaddy-mcp",
        officialPublicMcp: "https://api.godaddy.com/v1/domains/mcp",
        tools: TOOLS.map((t) => t.name),
      });
    }
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "GET or POST" });
    requireMcpToken(req);
    const body = await readJson(req);
    const id = body.id;
    const method = body.method;
    if (method === "initialize") {
      return send(res, 200, {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "orgsuite-godaddy-mcp", version: "1.0.0" },
          capabilities: { tools: {} },
        },
      });
    }
    if (method === "tools/list") {
      return send(res, 200, { jsonrpc: "2.0", id, result: { tools: TOOLS } });
    }
    if (method === "tools/call") {
      const result = await callTool(body.params && body.params.name, (body.params && body.params.arguments) || {});
      return send(res, 200, {
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result },
      });
    }
    if (typeof method === "string" && TOOLS.some((t) => t.name === method)) {
      const args = Array.isArray(body.params) ? {} : body.params || {};
      if (Array.isArray(body.params) && body.params[0]) args.domain = body.params[0];
      const result = await callTool(method, args);
      return send(res, 200, { jsonrpc: "2.0", id, result });
    }
    return send(res, 200, { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found: " + method } });
  } catch (err) {
    return send(res, err.status || 500, { ok: false, error: err.code || err.message });
  }
};
