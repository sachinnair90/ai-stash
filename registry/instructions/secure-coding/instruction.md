# Secure Coding Standards

Apply these security practices to all code written in this project. These are non-negotiable minimums, not suggestions.

## Input & Output

- **Validate at every boundary**: all user inputs, API responses, and inter-service messages must be validated and sanitised before use
- **Parameterise all queries**: never use string concatenation to build SQL, shell commands, or template strings with untrusted data
- **Encode outputs**: HTML-encode or escape all user-controlled values rendered in templates or responses
- **Reject early**: validate inputs at the entry point and return a clear error rather than propagating invalid data deep into the call stack

## Secrets & Configuration

- **No secrets in source**: API keys, passwords, tokens, and connection strings must live in environment variables or a secrets manager — never in code, config files, or comments
- **Use `.env.example`**: document required environment variables with placeholder values; never commit `.env`
- **Rotate on exposure**: if a secret is accidentally committed, treat it as compromised and rotate it immediately — rewriting git history is not sufficient

## Authentication & Authorisation

- **Check auth on every protected route**: do not rely on client-side gating alone; enforce server-side
- **Principle of least privilege**: request only the permissions a component genuinely needs
- **Expire sessions and tokens**: set appropriate TTLs; provide explicit logout/revocation paths

## Error Handling

- **Never expose internals**: return generic error messages to clients; log full details server-side only
- **Fail closed**: when in doubt, deny the operation rather than allowing it
- **Log meaningful context**: include request IDs, affected resource types, and timestamps — but never log PII, passwords, or tokens

## Dependencies

- **Pin versions**: avoid open-ended ranges (`^`, `~`) in production dependencies
- **Audit regularly**: run `npm audit` / `pip-audit` / equivalent in CI and address HIGH/CRITICAL findings before merge
- **Minimise surface area**: prefer fewer, well-maintained dependencies over many small ones

## Data Handling

- **Minimise PII collection**: only collect data you have a specific reason to store
- **Encrypt at rest and in transit**: use TLS for all external communication; encrypt sensitive fields in the database
- **Scrub from logs**: ensure logging middleware strips tokens, passwords, card numbers, and PII before writing
