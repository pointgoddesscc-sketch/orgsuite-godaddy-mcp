// api/mcp.js

const actions = require('../lib/actions'); // Assuming mcp.js is in api/ and actions.js in lib/

const tools = {
  health: actions.healthPayload,
  list_domains: actions.listDomains,
  get_domain: actions.getDomain,
  get_dns: actions.getDns,
  set_auto_renew: actions.setAutoRenew,
  upsert_dns: actions.upsertDns,
  plan_microsoft_365_dns: actions.planMicrosoft365Dns,
  plan_ssl_dns: actions.planSslDns,
};

module.exports = async (event, context) => {
  const { method, headers, body } = event;

  if (method === 'GET') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.keys(tools)),
    };
  }

  if (method === 'POST') {
    const mcpToken = headers['authorization'] || headers['Authorization'];
    if (!process.env.ORGSUITE_MCP_TOKEN || mcpToken !== `Bearer ${process.env.ORGSUITE_MCP_TOKEN}`) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized: Missing or invalid ORGSUITE_MCP_TOKEN' }),
      };
    }

    try {
      const { jsonrpc, id, method, params } = JSON.parse(body);

      if (jsonrpc !== '2.0') {
        throw new Error('Invalid JSON-RPC version');
      }

      const toolFunction = tools[method];
      if (!toolFunction) {
        throw new Error(`Method not found: ${method}`);
      }

      const result = await toolFunction(...(params || []));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, result }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message: error.message } }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Method Not Allowed' }),
  };
};