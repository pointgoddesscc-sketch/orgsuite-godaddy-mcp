// lib/godaddy.js

const PRIMARY = 'psemanagement.services';

let authMode = process.env.GODADDY_PAT ? 'Bearer' : 'sso-key';

function getAuthHeader() {
  if (authMode === 'Bearer' && process.env.GODADDY_PAT) {
    return `Bearer ${process.env.GODADDY_PAT}`;
  } else if (authMode === 'sso-key' && process.env.GODADDY_KEY && process.env.GODADDY_SECRET) {
    return `sso-key ${process.env.GODADDY_KEY}:${process.env.GODADDY_SECRET}`;
  }
  throw new Error('GoDaddy authentication environment variables not set correctly.');
}

const allowedDomains = (process.env.GODADDY_ALLOWED_DOMAINS || PRIMARY).split(',').map(d => d.trim());

function assertAllowed(domain) {
  if (!allowedDomains.includes(domain)) {
    throw new Error(`Domain ${domain} is not in the allowed list.`);
  }
}

async function godaddy(method, path, body = null) {
  const headers = {
    'Authorization': getAuthHeader(),
    'Content-Type': 'application/json',
  };

  const url = `https://api.godaddy.com/${path}`;
  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GoDaddy API Error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  return response.json();
}

function sanitizeDomain(domain) {
  return domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

function daysUntil(dateString) {
  const now = new Date();
  const targetDate = new Date(dateString);
  const diffTime = targetDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

module.exports = {
  PRIMARY,
  authMode,
  authHeader: getAuthHeader,
  allowedDomains,
  assertAllowed,
  godaddy,
  sanitizeDomain,
  daysUntil,
};