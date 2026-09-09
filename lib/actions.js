const { PRIMARY, authMode, assertAllowed, godaddy, sanitizeDomain, daysUntil } = require("./godaddy");

async function listDomains() {
  const rows = await godaddy("GET", "/v1/domains?limit=100");
  const list = Array.isArray(rows) ? rows : [];
  return {
    ok: true,
    count: list.length,
    domains: list.map((d) => ({ ...sanitizeDomain(d), daysUntilExpiration: daysUntil(d.expires) })),
  };
}

async function getDomain(name) {
  const domain = assertAllowed(name || PRIMARY);
  const raw = await godaddy("GET", `/v1/domains/${encodeURIComponent(domain)}`);
  const clean = sanitizeDomain(raw);
  return { ok: true, domain, daysUntilExpiration: daysUntil(clean.expires), ...clean };
}

async function getDns(name, type, host) {
  const domain = assertAllowed(name || PRIMARY);
  let path = `/v1/domains/${encodeURIComponent(domain)}/records`;
  if (type) {
    path += `/${encodeURIComponent(type)}`;
    if (host) path += `/${encodeURIComponent(host)}`;
  }
  const records = await godaddy("GET", path);
  return { ok: true, domain, count: Array.isArray(records) ? records.length : 0, records };
}

async function upsertDns({ domain, type, name, records, apply }) {
  const d = assertAllowed(domain || PRIMARY);
  const t = String(type || "").toUpperCase();
  const n = name || "@";
  if (!t || !Array.isArray(records) || !records.length) {
    const err = new Error("type and records[] required");
    err.status = 400;
    throw err;
  }
  const path = `/v1/domains/${encodeURIComponent(d)}/records/${encodeURIComponent(t)}/${encodeURIComponent(n)}`;
  if (!apply) return { ok: true, dryRun: true, method: "PUT", path, records };
  await godaddy("PUT", path, { body: records });
  return { ok: true, dryRun: false, applied: true, domain: d, type: t, name: n };
}

async function setAutoRenew({ domain, renewAuto, apply }) {
  const d = assertAllowed(domain || PRIMARY);
  if (typeof renewAuto !== "boolean") {
    const err = new Error("renewAuto boolean required");
    err.status = 400;
    throw err;
  }
  const path = `/v1/domains/${encodeURIComponent(d)}`;
  const body = { renewAuto };
  if (!apply) return { ok: true, dryRun: true, method: "PATCH", path, body };
  await godaddy("PATCH", path, { body });
  return { ok: true, dryRun: false, applied: true, domain: d, renewAuto };
}

function m365Plan(domain) {
  const d = domain || PRIMARY;
  const host = d.replace(/\./g, "-");
  return {
    domain: d,
    warning: "Replace TENANT with the Microsoft 365 tenant prefix before apply.",
    records: [
      { type: "MX", name: "@", data: `${host}.mail.protection.outlook.com`, priority: 0, ttl: 3600 },
      { type: "TXT", name: "@", data: "v=spf1 include:spf.protection.outlook.com -all", ttl: 3600 },
      { type: "CNAME", name: "autodiscover", data: "autodiscover.outlook.com", ttl: 3600 },
      { type: "CNAME", name: "selector1._domainkey", data: `selector1-${host}._domainkey.TENANT.onmicrosoft.com`, ttl: 3600 },
      { type: "CNAME", name: "selector2._domainkey", data: `selector2-${host}._domainkey.TENANT.onmicrosoft.com`, ttl: 3600 },
      { type: "TXT", name: "_dmarc", data: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${d}`, ttl: 3600 },
    ],
  };
}

function sslPlan(domain, extra = {}) {
  const d = domain || PRIMARY;
  const records = [];
  if (extra.validationTxtName && extra.validationTxtData) {
    records.push({ type: "TXT", name: extra.validationTxtName, data: extra.validationTxtData, ttl: 600 });
  }
  if (extra.hostname && extra.target) {
    records.push({ type: "CNAME", name: extra.hostname, data: extra.target, ttl: 600 });
  }
  records.push({ type: "CAA", name: "@", data: '0 issue "letsencrypt.org"', ttl: 3600 });
  return { domain: d, records };
}

function healthPayload() {
  const mode = authMode();
  return {
    ok: mode !== "missing",
    service: "orgsuite-godaddy-mcp",
    domain: PRIMARY,
    status: mode === "missing" ? "keys_missing" : "configured",
    authMode: mode,
    officialPublicMcp: {
      url: "https://api.godaddy.com/v1/domains/mcp",
      transport: "streamable-http",
      capabilities: ["domains_check_availability", "domains_suggest"],
      accountManagement: false,
    },
    message:
      mode === "missing"
        ? "Set GODADDY_PAT (preferred) or GODADDY_API_KEY + GODADDY_API_SECRET in Vercel env. Owner-only."
        : "Credentials present on host. Use /api/godaddy/domains with ORGSUITE_MCP_TOKEN.",
  };
}

module.exports = {
  listDomains,
  getDomain,
  getDns,
  upsertDns,
  setAutoRenew,
  m365Plan,
  sslPlan,
  planMicrosoft365Dns: (domain) => ({ ok: true, dryRun: true, ...m365Plan(domain) }),
  planSslDns: (domain, extra) => ({ ok: true, dryRun: true, ...sslPlan(domain, extra) }),
  healthPayload,
};
