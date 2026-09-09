const { PRIMARY } = require("../lib/godaddy");
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

const PROTOCOL = "2025-03-26";
const SERVER_NAME = "orgsuite-godaddy-mcp";
const SERVER_VERSION = "1.0.0";
const SERVER_TITLE = "OrgSuite GoDaddy Management MCP";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, MCP-Protocol-Version, Mcp-Session-Id",
    "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
    "MCP-Protocol-Version": PROTOCOL,
  };
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...corsHeaders(),
  });
  res.end(JSON.stringify(body));
}

function requireSharedSecret(req) {
  const expected = process.env.ORGSUITE_MCP_TOKEN || process.env.MCP_SHARED_SECRET;
  if (!expected || !String(expected).trim()) return { ok: true };
  const header = req.headers.authorization || "";
  const token = String(header).replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== String(expected).trim()) return { ok: false };
  return { ok: true };
}

const TOOLS = [
  {
    name: "health",
    description: "Sanitized GoDaddy management status for psemanagement.services. No secrets.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_domains",
    description: "List GoDaddy account domains and expiration dates. Requires GODADDY_PAT on the host.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_domain",
    description: "Get expiration, lock, auto-renew, and nameservers. Defaults to psemanagement.services.",
    inputSchema: {
      type: "object",
      properties: { domain: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_dns",
    description: "Read DNS records for an allowlisted domain.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string" },
        type: { type: "string" },
        host: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "set_auto_renew",
    description: "Preview or set renewAuto. apply=true required to write.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string" },
        renewAuto: { type: "boolean" },
        apply: { type: "boolean" },
      },
      required: ["renewAuto"],
      additionalProperties: false,
    },
  },
  {
    name: "upsert_dns",
    description: "Preview or replace one DNS name/type. apply=true required to write.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string" },
        type: { type: "string" },
        name: { type: "string" },
        records: { type: "array", items: { type: "object" } },
        apply: { type: "boolean" },
      },
      required: ["type", "records"],
      additionalProperties: false,
    },
  },
  {
    name: "plan_microsoft_365_dns",
    description: "Return Microsoft 365 MX/SPF/Autodiscover/DKIM/DMARC plan. Does not write DNS.",
    inputSchema: {
      type: "object",
      properties: { domain: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "plan_ssl_dns",
    description: "Return SSL validation DNS plan. Does not write DNS.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string" },
        validationTxtName: { type: "string" },
        validationTxtData: { type: "string" },
        hostname: { type: "string" },
        target: { type: "string" },
      },
      additionalProperties: false,
    },
  },
];

function textResult(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

async function callTool(name, args) {
  const input = args && typeof args === "object" ? args : {};
  if (name === "health") return textResult(healthPayload());
  if (name === "list_domains") return textResult(await listDomains());
  if (name === "get_domain") return textResult(await getDomain(input.domain || PRIMARY));
  if (name === "get_dns") return textResult(await getDns(input.domain || PRIMARY, input.type, input.host));
  if (name === "set_auto_renew") {
    return textResult(await setAutoRenew({ domain: input.domain, renewAuto: input.renewAuto, apply: input.apply === true }));
  }
  if (name === "upsert_dns") {
    return textResult(await upsertDns({
      domain: input.domain,
      type: input.type,
      name: input.name,
      records: input.records,
      apply: input.apply === true,
    }));
  }
  if (name === "plan_microsoft_365_dns") return textResult(planMicrosoft365Dns(input.domain || PRIMARY));
  if (name === "plan_ssl_dns") return textResult(planSslDns(input.domain || PRIMARY, input));
  const err = new Error("Unknown tool: " + name);
  err.code = "UNKNOWN_TOOL";
  throw err;
}

async function handleMcpMessage(message) {
  if (!message || typeof message !== "object") return null;
  const { id, method, params } = message;
  if (!method) return null;
  if (id === undefined || id === null) return null;
  try {
    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION, title: SERVER_TITLE },
        },
      };
    }
    if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
    if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    if (method === "tools/call") {
      const result = await callTool(params && params.name, params && params.arguments);
      return { jsonrpc: "2.0", id, result };
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found: " + method } };
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      result: textResult({
        status: err && err.code === "keys_missing" ? "Requires Authorization" : "error",
        error: err && err.message ? err.message : "Tool failed",
        httpStatus: err && err.status ? err.status : undefined,
      }),
    };
  }
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, {
      name: SERVER_NAME,
      title: SERVER_TITLE,
      version: SERVER_VERSION,
      protocol: PROTOCOL,
      endpoints: { health: "/api/godaddy/health", mcp: "/api/mcp" },
      officialPublicMcp: "https://api.godaddy.com/v1/domains/mcp",
      grokConnectorUrl: "https://orgsuite-godaddy-mcp.vercel.app/api/mcp",
      tools: TOOLS.map((t) => t.name),
      health: healthPayload(),
    });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const auth = requireSharedSecret(req);
  if (!auth.ok) {
    sendJson(res, 401, {
      status: "Requires Authorization",
      error: "ORGSUITE_MCP_TOKEN is set. Send Authorization: Bearer <token>.",
    });
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    sendJson(res, 400, { error: "Invalid JSON" });
    return;
  }

  const messages = Array.isArray(payload) ? payload : [payload];
  const responses = [];
  for (const message of messages) {
    const result = await handleMcpMessage(message);
    if (result) responses.push(result);
  }

  if (responses.length === 0) {
    res.writeHead(202, { "Cache-Control": "no-store", ...corsHeaders() });
    res.end();
    return;
  }

  sendJson(res, 200, Array.isArray(payload) ? responses : responses[0]);
};
