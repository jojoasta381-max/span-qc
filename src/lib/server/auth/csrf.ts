/**
 * Origin and Referer validation for CSRF defense on state-changing requests.
 * Defends against Cross-Site Request Forgery while supporting canonical application origins,
 * trusted reverse proxies, and local development.
 */

/**
 * Returns the set of explicitly allowed application hostnames.
 * Reads configured canonical application origins and development defaults.
 */
export function getTrustedHosts(): Set<string> {
  const hosts = new Set<string>();

  // 1. Configured Canonical Application Origin / Allowed Origins
  const configSources = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.CANONICAL_ORIGIN,
    process.env.ALLOWED_ORIGINS,
    process.env.NEXTAUTH_URL,
  ];

  for (const src of configSources) {
    if (!src) continue;
    const parts = src.split(",").map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      try {
        if (part.includes("://")) {
          const url = new URL(part);
          hosts.add(url.host.toLowerCase());
        } else {
          hosts.add(part.toLowerCase());
        }
      } catch {
        // Ignore invalid URL format in environment config
      }
    }
  }

  // 2. Allow local loopback development hosts when not in production
  if (process.env.NODE_ENV !== "production") {
    hosts.add("localhost");
    hosts.add("127.0.0.1");
    hosts.add("[::1]");
    hosts.add("localhost:3000");
    hosts.add("127.0.0.1:3000");
    hosts.add("localhost:3001");
    hosts.add("127.0.0.1:3001");
  }

  return hosts;
}

/**
 * Validates whether the incoming state-changing request originated from a trusted source.
 * Rejects cross-site, malformed, or untrusted origins with false (HTTP 403).
 */
export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const secFetchSite = request.headers.get("sec-fetch-site");

  // 1. Inspect Fetch Metadata: reject cross-site navigation/subrequests immediately
  if (secFetchSite === "cross-site") {
    return false;
  }

  const trustedHosts = getTrustedHosts();

  // Determine local request host from request URL or Host header
  const hostHeader = (request.headers.get("host") || "").toLowerCase().trim();
  let localRequestHost = "";
  try {
    localRequestHost = new URL(request.url).host.toLowerCase();
  } catch {
    localRequestHost = hostHeader;
  }

  // Trusted proxy policy:
  // If TRUST_PROXY is explicitly enabled, we can inspect X-Forwarded-Host,
  // BUT we only accept it if it matches our pre-configured trusted hosts list!
  // We NEVER blindly trust arbitrary X-Forwarded-Host or Host values sent by clients.
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim().toLowerCase();
  const trustProxy = process.env.TRUST_PROXY === "true";

  // 2. Validate Origin header if present
  if (origin) {
    if (origin === "null") {
      // Sandboxed iframe or opaque origin
      return false;
    }
    let originHost = "";
    try {
      const originUrl = new URL(origin);
      originHost = originUrl.host.toLowerCase();
    } catch {
      // Malformed Origin header
      return false;
    }

    // A. Check against explicitly configured canonical / trusted application hosts
    if (trustedHosts.has(originHost)) {
      return true;
    }

    // B. Check against local request host or Host header (same-origin requests)
    if (
      (localRequestHost && originHost === localRequestHost) ||
      (hostHeader && originHost === hostHeader)
    ) {
      return true;
    }

    // C. Trusted proxy check: if forwardedHost matches origin AND is in trustedHosts
    if (trustProxy && forwardedHost && originHost === forwardedHost && trustedHosts.has(forwardedHost)) {
      return true;
    }

    return false; // Untrusted or mismatched Origin
  }

  // 3. Fall back to Referer header if present
  if (referer) {
    let refererHost = "";
    try {
      const refererUrl = new URL(referer);
      refererHost = refererUrl.host.toLowerCase();
    } catch {
      // Malformed Referer header
      return false;
    }

    if (trustedHosts.has(refererHost)) {
      return true;
    }

    if (
      (localRequestHost && refererHost === localRequestHost) ||
      (hostHeader && refererHost === hostHeader)
    ) {
      return true;
    }

    if (trustProxy && forwardedHost && refererHost === forwardedHost && trustedHosts.has(forwardedHost)) {
      return true;
    }

    return false; // Untrusted or mismatched Referer
  }

  // 4. Safe fallback when neither Origin nor Referer is provided:
  // - In production, browser state-changing requests send Origin.
  // - Rejects if sec-fetch-site is cross-site (handled above in step 1).
  // - Permits local development, non-browser programmatic clients (CLI, automated tests).
  return true;
}
