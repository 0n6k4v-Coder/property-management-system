# **Top 23 API Design Anti Pattern**

1. No idempotency for POST, payment, or provisioning endpoints (missing Idempotency-Key)
2. Missing timeout, retry, and retry-safe semantics (causing cascading failures or self-DDoS)
3. Ambiguous error handling: always returning 200 OK, inconsistent status codes, or unstable error formats
4. Misusing HTTP verbs and status codes: using POST for everything, ignoring HTTP semantics
5. Weak authentication and authorization: long-lived tokens, missing scopes, no least-privilege access
6. No rate limiting or quotas: unlimited requests without abuse/spike protection
7. Weak input validation: accepting invalid data, inconsistent rules, unclear validation errors
8. Webhook design without signature verification or replay protection
9. Breaking changes without versioning or a clear deprecation window
10. Leaking internal database models into the API contract (field names, IDs, join tables)
11. Inconsistent API design: mixed naming conventions, inconsistent resource modeling
12. Schema/type coercion ambiguity (e.g., string "123" vs number 123 inconsistently represented)
13. Unbounded list endpoints: no pagination, no maximum page size, no server-side limits
14. Chatty APIs: excessive round trips, N+1 over HTTP, no batch endpoints, no sparse field selection
15. Blocking on long-running tasks: synchronous processing instead of 202 Accepted with polling/webhooks
16. Nested/circular resource depth unbounded (uncontrolled relation expansion, over-fetching)
17. No observability: missing request IDs, structured logs, distributed tracing, per-route metrics
18. Outdated or inaccurate documentation: OpenAPI specs not matching implementation, undocumented fields
19. Ambiguous timezone and date-time handling: missing UTC offsets, inconsistent timestamp units
20. Poor caching strategy: missing ETags, incorrect Cache-Control, no cache validation
21. Overly complex or "magic" query parameters: undocumented filtering/sorting syntax
22. Ignoring content negotiation: not respecting Accept header, incorrect Content-Type
23. Ignoring CORS and browser constraints: missing CORS headers, failing to handle preflight OPTIONS