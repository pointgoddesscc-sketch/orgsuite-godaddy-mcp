const API_BASE = (process.env.GODADDY_API_BASE || "https://api.godaddy.com").replace(/\/$/, "");
const PRIMARY = (process.env.GODADDY_PRIMARY_DOMAIN || "psemanagement.services").toLowerCase();

function authMode() {
  if (process.env.GODADDY_PAT) return "pat";
  if (process.env.GODADDY_API_KEY && process.env.GODADDY_API_SECRET) return "sso-key";
  return "missing";
}

function authHeader() {
  const mode = authMode();
  if (mode === "pat") return `Bearer ${process.env.GODADDY_PAT}`;
  if (mode === "sso-key") return `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`;
  return null;
}

function allowedDomains() {
  const raw = process.env.GODADDY_ALLOWED_DOMAINS || PRIMARY;
  const set = new Set(raw.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean));
  set.add(PRIMARY);
  return set;
}

function assertAllowed(domain) {
  const name = String(domain || PRIMARY).trim().toLowerCase();
  if (!allowedDomains().has(name)) {
    const err = new Error(`Domain not on OrgSuite allowlist: ${name}`);
    err.status = 403;
    throw err;
  }
  return name;
}

async function godaddy(method, path, { body } = {}) {
  const header = authHeader();
  if (!header) {
    const err = new Error("keys_missing");
    err.status = 503;
    err.code = "keys_missing";
    throw err;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: header,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(json?.message || json?.code || `GoDaddy ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function sanitizeDomain(d) {
  if (!d || typeof d !== "object") return d;
  return {
    domain: d.domain,
    status: d.status,
    expires: d.expires,
    expireDate: d.expires,
    renewAuto: d.renewAuto,
    renewDeadline: d.renewDeadline,
    locked: d.locked,
    privacy: d.privacy,
    holdRegistrar: d.holdRegistrar,
    expirationProtected: d.expirationProtected,
    transferProtected: d.transferProtected,
    nameServers: d.nameServers,
    createdAt: d.createdAt,
    renewDisabled: d.renewDisabled,
  };
}

function daysUntil(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso) - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.round(ms / 86400000);
}

module.exports = { PRIMARY, authMode, authHeader, allowedDomains, assertAllowed, godaddy, sanitizeDomain, daysUntil };
