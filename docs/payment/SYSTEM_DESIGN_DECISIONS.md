# SpanQC System Design Decisions & Architecture Decision Record (ADR)

**Document:** `docs/payment/SYSTEM_DESIGN_DECISIONS.md`  
**Date:** 2026-10-17  
**Commit SHA:** `0e55fb1a741f84398d02d3d5f52ed3e1b8277f25`  
**Scope:** SpanQC Multi-Tenant Architecture & Payment Integration

---

## 1. System Design Concepts Checklist

| Concept | Status | Application Guidance & Evidence | Trade-offs & Rationale | Revisit Trigger |
| :--- | :--- | :--- | :--- | :--- |
| **Client-server architecture** | `USE_NOW` | Browser renders state; server owns payment verification, tenant scope, and entitlements. Evidence: `src/proxy.ts`, `src/lib/server/auth/session.ts`. | Enforces fail-closed security. Client never controls prices or payment status. | Permanent principle. |
| **Vertical vs horizontal scaling** | `USE_NOW` | Scale ECS tasks / background workers based on measured CPU, RAM, and queue latency. Evidence: Stateless Next.js container design. | Avoids premature cluster overhead; scales compute with actual diagram inspection loads. | Average CPU > 70% or queue depth > 50 jobs for 15 mins. |
| **Load balancing** | `USE_NOW` | Single Application Load Balancer (ALB) handles TLS termination and health routing. Evidence: AWS ALB staging setup. | Centralizes SSL and routing; prevents unnecessary multi-tier ingress complexity. | Multi-region deployment requirements. |
| **Caching (CDN / Redis)** | `Selective` | Cache static assets (`/frames/`, CSS/JS bundles) via CloudFront/CDN. Never cache payment verification or tenant quotas. | Stale cache in billing or quota can cause double spend or unauthorized access. | Latency spikes on public static assets. |
| **Database sharding** | `NOT_NEEDED_YET` | Single relational database (PostgreSQL / SQLite for dev) is more than sufficient. | Sharding introduces massive cross-tenant transaction and operational complexity. | DB size > 1TB or single-table IOPS bottleneck. |
| **Database replication** | `DESIGN_FOR_LATER` | Authoritative single-writer architecture. Read replicas for heavy analytics queries in future. | Payment and entitlement transactions must always use the authoritative writer, never lagging replicas. | Analytical reporting degrades transactional write latency. |
| **SQL vs NoSQL** | `USE_NOW: SQL` | Relational schema with foreign keys, unique constraints, and atomic transactions. Evidence: `prisma/schema.prisma`. | Guarantees ACID properties for financial ledgers, idempotency keys, and tenant isolation. | None (SQL is core to financial integrity). |
| **CAP theorem** | `USE_NOW` | Prioritize Consistency (C) and Partition tolerance (P) over high availability during network splits. | Fail-closed: delay or reject entitlement rather than grant access on uncertain provider data. | Permanent design law. |
| **Consistency models** | `USE_NOW` | Strict serializable/transactional consistency for payment and entitlement ledgers; eventual consistency acceptable for dashboards. | Prevents duplicate credit grants under race conditions. | Permanent design law. |
| **Indexing** | `USE_NOW` | Indexes on `providerOrderId`, `providerPaymentId`, `idempotencyKey`, `tenantId`, and `status`. Evidence: `prisma/schema.prisma`. | Eliminates full table scans on webhook lookups and tenant queries. | Query execution time > 50ms on indexed routes. |
| **Message queues** | `Conditional` | Background worker loop active for asynchronous QC processing. Evidence: `next.config.ts` scheduler. | Avoids introducing Kafka/RabbitMQ solely for checkout; webhook inbox handles async payment events. | QC analysis job backlog > 100 sustained jobs. |
| **Microservices vs monolith** | `USE_NOW: Monolith` | Modular monolith with clean separation (`src/lib/server/billing/*`, `src/lib/server/qc/*`). | Eliminates distributed transaction failures and network overhead between billing and app logic. | Independent team scaling or deployment decoupling needs. |
| **API design** | `USE_NOW: REST` | Standard RESTful HTTP APIs with JSON payloads and safe error codes. Evidence: `src/app/api/v1/*`. | Aligns with existing Next.js App Router patterns; avoids unnecessary GraphQL/gRPC complexity. | Complex graph traversal requirements from mobile clients. |
| **API gateway** | `NOT_NEEDED_YET` | Application proxy (`src/proxy.ts`) and ALB handle routing, auth headers, and CORS. | Standalone gateway adds cost and operational overhead without added value at pilot stage. | Need for centralized cross-service rate limiting or API monetization. |
| **Rate limiting** | `USE_NOW` | Apply rate limits on checkout creation, order verification, and sensitive auth routes. | Protects against credential stuffing and provider API quota exhaustion. | Abuse detected or > 100 req/min per IP. |
| **Consistent hashing** | `NOT_NEEDED_YET` | Not required; no custom sharding or multi-node cache partitioning. | Unnecessary complexity for single-node / single-cluster database setup. | Adoption of distributed caching clusters. |
| **Forward/reverse proxies**| `USE_NOW` | Reverse proxy validates `Origin`, `Referer`, and injects verified `x-user-id`. Evidence: `src/proxy.ts`. | Protects backend handlers from CSRF and spoofed tenant headers. | Permanent security requirement. |
| **CDN** | `Selective` | Edge distribution for marketing assets and hero canvas frames. Private diagrams and reports strictly excluded. | Protects proprietary customer CAD drawings and wiring schematics from public exposure. | Permanent data protection rule. |
| **Fault tolerance & HA** | `USE_NOW` | Health check probes (`/api/v1/auth/me`), bounded retries, and safe pending states. | Prevents silent failures; ensures system fails safely without false positive passes. | Production uptime SLA commitment (> 99.9%). |
| **Observability** | `USE_NOW` | Structured console logging with error codes; CloudWatch integration. Secrets strictly redacted. | Enables tracing without exposing sensitive customer data or provider credentials. | Log volume > 10GB/day. |

---

## 2. Core Payment & Entitlement Design Invariants

1. **Server-Derived Tenant Identity:**
   * Client-supplied tenant IDs in request bodies or query parameters are ignored.
   * `session.tenantId` is the sole source of truth for all billing and entitlement records.
2. **Deterministic Idempotency:**
   * Webhook events and order creations enforce compound unique constraints (`providerEventId`, `tenantId_idempotencyKey`).
   * Duplicate deliveries return existing status without duplicating ledger entries.
3. **Fail-Closed Verification:**
   * Browser callbacks (`razorpay_payment_id`, `razorpay_signature`) trigger backend signature recalculation using `RAZORPAY_KEY_SECRET`.
   * Entitlements are granted only if signature verifies and payment is verified in `captured` state.
4. **Minor Currency Units:**
   * All prices and balances stored strictly as integer paise (e.g. `2499900` for ₹24,999.00) to prevent floating-point calculation errors.
5. **Billing Mode Flag:**
   * `BILLING_STATUS` defaults to `NOT_LIVE`. Live charges are blocked by application code until explicitly approved and configured.
