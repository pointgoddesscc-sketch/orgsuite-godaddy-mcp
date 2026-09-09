# OrgSuite GoDaddy Managed Control Plane (MCP) Service

This service acts as a private, authenticated Managed Control Plane (MCP) for managing GoDaddy domains and DNS records through the OrgSuite ecosystem. It provides a set of RPC-style endpoints for programmatic interaction with GoDaddy's API, leveraging either a Personal Access Token (PAT) or an SSO Key for authentication.

**Key Features:**

*   **Authenticated Access:** Unlike public MCPs, this service requires an `ORGSUITE_MCP_TOKEN` for POST requests, ensuring only authorized OrgSuite components can interact with it.
*   **GoDaddy API Integration:** Wraps core GoDaddy domain and DNS management functionalities.
*   **Domain Allowlist:** Restricts operations to a predefined set of domains for enhanced security and control.
*   **Dry-Run Capabilities:** Many actions (e.g., `upsert_dns`, `set_auto_renew`) support a dry-run mode to preview changes without applying them.
*   **Planning Tools:** Includes specific planning tools for common configurations like Microsoft 365 DNS and SSL DNS.

## Authentication

This service authenticates with the GoDaddy API using the following environment variables, in order of preference:

1.  **`GODADDY_PAT` (Personal Access Token):** Preferred method for Bearer token authentication.
2.  **`GODADDY_KEY` and `GODADDY_SECRET` (SSO Key):** Fallback for Basic authentication.

For accessing this MCP service itself, a `Bearer` token matching the `ORGSUITE_MCP_TOKEN` environment variable must be provided in the `Authorization` header for all `POST` requests.

## Endpoints

*   **`/api/mcp` (POST):** JSON-RPC endpoint for executing GoDaddy actions. Requires `Authorization: Bearer <ORGSUITE_MCP_TOKEN>`.
*   **`/api/mcp` (GET):** Returns a list of available JSON-RPC methods/tools.
*   **`/api/godaddy/health` (GET):** A simple status endpoint to check the health and connectivity of the GoDaddy integration.

## Available Tools (via JSON-RPC POST to `/api/mcp`)

*   `health()`: Returns the health status of the GoDaddy integration.
*   `list_domains()`: Lists all domains associated with the GoDaddy account.
*   `get_domain(domain)`: Retrieves details for a specific domain.
*   `get_dns(domain)`: Retrieves DNS records for a specific domain.
*   `set_auto_renew(domain, autoRenew, apply=false)`: Sets the auto-renew status for a domain. Supports dry-run.
*   `upsert_dns(domain, records, apply=false)`: Creates or updates DNS records for a domain. Supports dry-run.
*   `plan_microsoft_365_dns(domain)`: Returns a dry-run plan for configuring Microsoft 365 DNS records.
*   `plan_ssl_dns(domain)`: Returns a dry-run plan for configuring SSL-related DNS records.

## Usage Example (Conceptual)

```json
// JSON-RPC POST request to /api/mcp
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "get_domain",
  "params": ["example.com"]
}
```

**Note:** Ensure all necessary environment variables (`GODADDY_PAT` or `GODADDY_KEY`/`GODADDY_SECRET`, `ORGSUITE_MCP_TOKEN`, `GODADDY_ALLOWED_DOMAINS`) are configured for the service to function correctly.
