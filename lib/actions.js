// lib/actions.js

const { godaddy, assertAllowed, sanitizeDomain, daysUntil } = require('./godaddy');

async function listDomains() {
  return await godaddy('GET', 'v1/domains');
}

async function getDomain(domain) {
  const sanitizedDomain = sanitizeDomain(domain);
  assertAllowed(sanitizedDomain);
  return await godaddy('GET', `v1/domains/${sanitizedDomain}`);
}

async function getDns(domain) {
  const sanitizedDomain = sanitizeDomain(domain);
  assertAllowed(sanitizedDomain);
  return await godaddy('GET', `v1/domains/${sanitizedDomain}/records`);
}

async function upsertDns(domain, records, apply = false) {
  const sanitizedDomain = sanitizeDomain(domain);
  assertAllowed(sanitizedDomain);
  if (!apply) {
    console.log(`Dry-run: Would have updated DNS records for ${sanitizedDomain} with:`, records);
    return { dryRun: true, message: 'DNS records not updated (dry-run).' };
  }
  return await godaddy('PUT', `v1/domains/${sanitizedDomain}/records`, records);
}

async function setAutoRenew(domain, autoRenew, apply = false) {
  const sanitizedDomain = sanitizeDomain(domain);
  assertAllowed(sanitizedDomain);
  if (!apply) {
    console.log(`Dry-run: Would have set auto-renew for ${sanitizedDomain} to ${autoRenew}.`);
    return { dryRun: true, message: 'Auto-renew not changed (dry-run).' };
  }
  return await godaddy('PATCH', `v1/domains/${sanitizedDomain}`, { autoRenew });
}

async function planMicrosoft365Dns(domain) {
  const sanitizedDomain = sanitizeDomain(domain);
  assertAllowed(sanitizedDomain);
  console.log(`Dry-run plan for Microsoft 365 DNS for ${sanitizedDomain}.`);
  // This would typically involve fetching current DNS, comparing with M365 requirements, and suggesting changes.
  // For this example, we'll just return a placeholder.
  return {
    dryRun: true,
    message: `Proposed changes for Microsoft 365 DNS on ${sanitizedDomain} (dry-run).`,
    // Example of what would be returned:
    suggestedRecords: [
      { type: 'MX', name: '@', data: 'mail.protection.outlook.com', priority: 0, ttl: 3600 },
      { type: 'TXT', name: '@', data: 'v=spf1 include:spf.protection.outlook.com -all', ttl: 3600 },
      // ... more records
    ]
  };
}

async function planSslDns(domain) {
  const sanitizedDomain = sanitizeDomain(domain);
  assertAllowed(sanitizedDomain);
  console.log(`Dry-run plan for SSL DNS for ${sanitizedDomain}.`);
  // This would typically involve fetching current DNS, checking for CAA, CNAME for verification, etc.
  // For this example, we'll just return a placeholder.
  return {
    dryRun: true,
    message: `Proposed changes for SSL DNS on ${sanitizedDomain} (dry-run).`,
    // Example of what would be returned:
    suggestedRecords: [
      { type: 'CAA', name: '@', data: '0 issue "digicert.com"', ttl: 3600 },
      // ... more records
    ]
  };
}

async function healthPayload() {
  try {
    const domains = await listDomains();
    return {
      status: 'healthy',
      message: `Successfully listed ${domains.length} domains.`,
      authMode: require('./godaddy').authMode,
      allowedDomains: require('./godaddy').allowedDomains,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Failed to list domains: ${error.message}`,
      authMode: require('./godaddy').authMode,
      allowedDomains: require('./godaddy').allowedDomains,
    };
  }
}

module.exports = {
  listDomains,
  getDomain,
  getDns,
  upsertDns,
  setAutoRenew,
  planMicrosoft365Dns,
  planSslDns,
  healthPayload,
};