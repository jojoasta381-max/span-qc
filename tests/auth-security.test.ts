import "./setup";
import { POST as loginHandler } from "../src/app/api/v1/auth/login/route";
import { GET as getMeHandler } from "../src/app/api/v1/auth/me/route";
import { POST as logoutHandler } from "../src/app/api/v1/auth/logout/route";
import { GET as getOrgHandler } from "../src/app/api/v1/organizations/me/route";
import { GET as getProjectsHandler, POST as createProjectHandler } from "../src/app/api/v1/projects/route";
import { proxy } from "../src/proxy";
import { NextRequest } from "next/server";
import { db } from "../src/lib/server/db";
import { TEST_PASSWORDS, runSeed } from "../prisma/seed";
import { SESSION_COOKIE_NAME, signSessionToken, revokeAllUserSessions, hashToken } from "../src/lib/server/auth/session";
import { provisionAdmin, validateEmail, validateOrgName } from "../scripts/provision-admin";
import { verifyPassword } from "../src/lib/server/auth/passwords";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  PASS: ${message}`);
    passedCount++;
  }
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("SPANQC PHASE 1 SECURITY & MULTI-TENANT TEST SUITE");
  console.log("================================================================================");

  // Reset and seed dedicated test database to guarantee clean test state
  await db.session.deleteMany();
  await db.project.deleteMany();
  await db.user.deleteMany();
  await db.tenant.deleteMany();
  await runSeed();

  // ----------------------------------------------------------------------------
  // Test 1: Invalid Login without Password
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 1] Login rejects request with missing password");
  {
    const req = new Request("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "pravin@spandsons.com" }),
    });
    const res = await loginHandler(req);
    assert(res.status === 400, "Returns HTTP 400 Bad Request when password is missing");
  }

  // ----------------------------------------------------------------------------
  // Test 2: Invalid Login with Wrong Password
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 2] Login rejects request with invalid password");
  {
    const req = new Request("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "pravin@spandsons.com", password: "wrong_password_999!" }),
    });
    const res = await loginHandler(req);
    assert(res.status === 401, "Returns HTTP 401 Unauthorized for incorrect password");
    const json = await res.json();
    assert(json.detail === "Invalid email or password.", "Returns generic error without leaking password status");
  }

  // ----------------------------------------------------------------------------
  // Test 3: Unknown User is Rejected (No Automatic Admin Account Creation)
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 3] Unknown user is rejected and never auto-created as admin");
  {
    const strangerEmail = "attacker_99@evil.corp";
    const req = new Request("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: strangerEmail, password: "any_password" }),
    });
    const res = await loginHandler(req);
    assert(res.status === 401, "Returns HTTP 401 Unauthorized for unknown user");

    const userInDb = await db.user.findUnique({ where: { email: strangerEmail } });
    assert(userInDb === null, "Verified user was NOT created in the database");
  }

  // ----------------------------------------------------------------------------
  // Test 4: Successful Valid Login & HttpOnly Cookie Security Flags
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 4] Valid login succeeds and sets HttpOnly, SameSite=Lax cookie");
  let pravinCookieHeader = "";
  let pravinToken = "";
  {
    const req = new Request("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "pravin@spandsons.com", password: TEST_PASSWORDS.pravin }),
    });
    const res = await loginHandler(req);
    assert(res.status === 200, "Returns HTTP 200 OK for valid credentials");

    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    assert(cookie !== undefined, "Cookie spanqc_session was set in response");
    assert(cookie?.httpOnly === true, "Cookie has httpOnly = true");
    assert(cookie?.sameSite === "lax", "Cookie has sameSite = 'lax'");
    assert(cookie?.path === "/", "Cookie has path = '/'");

    pravinToken = cookie?.value || "";
    pravinCookieHeader = `${SESSION_COOKIE_NAME}=${pravinToken}`;
    assert(pravinToken.length > 20, "Session token is valid non-empty string");
  }

  // ----------------------------------------------------------------------------
  // Test 5: Authenticated /api/v1/auth/me with Cookie Session
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 5] Authenticated /api/v1/auth/me returns caller profile");
  {
    const req = new Request("http://localhost:3000/api/v1/auth/me", {
      method: "GET",
      headers: { Cookie: pravinCookieHeader },
    });
    const res = await getMeHandler(req);
    assert(res.status === 200, "Returns HTTP 200 OK with valid session cookie");
    const json = await res.json();
    assert(json.email === "pravin@spandsons.com", "Identifies correct authenticated user");
    assert(json.role === "ADMIN", "Profile reflects database role");
  }

  // ----------------------------------------------------------------------------
  // Test 6: Missing / Invalid Session on /api/v1/auth/me Returns 401 (No Admin Fallback)
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 6] Unauthenticated /api/v1/auth/me returns 401 without defaulting to admin");
  {
    // Request with no cookie
    const reqNoCookie = new Request("http://localhost:3000/api/v1/auth/me", { method: "GET" });
    const resNoCookie = await getMeHandler(reqNoCookie);
    assert(resNoCookie.status === 401, "Returns HTTP 401 when unauthenticated");

    // Request with forged/tampered token
    const reqForged = new Request("http://localhost:3000/api/v1/auth/me", {
      method: "GET",
      headers: { Cookie: `${SESSION_COOKIE_NAME}=forged.token.here` },
    });
    const resForged = await getMeHandler(reqForged);
    assert(resForged.status === 401, "Returns HTTP 401 when token signature is invalid");
  }

  // ----------------------------------------------------------------------------
  // Test 7: Expired Session Enforcement
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 7] Expired session token is rejected with 401");
  {
    const expiredPayload = {
      userId: "usr-expired-test",
      tenantId: "tenant-expired-test",
      role: "ENGINEER",
      email: "expired@test.com",
      sessionId: "sess-expired-id",
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    };
    const expiredToken = signSessionToken(expiredPayload);

    const reqExpired = new Request("http://localhost:3000/api/v1/auth/me", {
      method: "GET",
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${expiredToken}` },
    });
    const resExpired = await getMeHandler(reqExpired);
    assert(resExpired.status === 401, "Returns HTTP 401 when session expiration has passed");
  }

  // ----------------------------------------------------------------------------
  // Test 8: Logout Invalidation
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 8] Logout revokes server session in DB and clears cookie");
  {
    // 1. Call logout
    const reqLogout = new Request("http://localhost:3000/api/v1/auth/logout", {
      method: "POST",
      headers: { Cookie: pravinCookieHeader },
    });
    const resLogout = await logoutHandler(reqLogout);
    assert(resLogout.status === 200, "Logout returns HTTP 200 OK");

    // 2. Validate token is now rejected
    const reqAfterLogout = new Request("http://localhost:3000/api/v1/auth/me", {
      method: "GET",
      headers: { Cookie: pravinCookieHeader },
    });
    const resAfterLogout = await getMeHandler(reqAfterLogout);
    assert(resAfterLogout.status === 401, "Session is revoked in database and rejected on subsequent calls");
  }

  // ----------------------------------------------------------------------------
  // Test 9: Server-Side Proxy Enforcement
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 9] Server-side proxy blocks unauthenticated web and API traffic");
  {
    // Log in again to get fresh valid token
    const loginReq = new Request("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "pravin@spandsons.com", password: TEST_PASSWORDS.pravin }),
    });
    const loginRes = await loginHandler(loginReq);
    const freshToken = loginRes.cookies.get(SESSION_COOKIE_NAME)!.value;

    // Test unauthenticated API request to proxy
    const proxyReqApiUnauth = new NextRequest("http://localhost:3000/api/v1/projects");
    const proxyResApiUnauth = await proxy(proxyReqApiUnauth);
    assert(proxyResApiUnauth.status === 401, "Proxy returns HTTP 401 for unauthenticated API routes");

    // Test unauthenticated Web request to proxy
    const proxyReqWebUnauth = new NextRequest("http://localhost:3000/app/check");
    const proxyResWebUnauth = await proxy(proxyReqWebUnauth);
    assert(proxyResWebUnauth.status === 307, "Proxy redirects unauthenticated web requests to /login");
    assert(
      proxyResWebUnauth.headers.get("location")?.includes("/login") === true,
      "Redirect target is /login"
    );

    // Test authenticated API request to proxy
    const proxyReqApiAuth = new NextRequest("http://localhost:3000/api/v1/projects", {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${freshToken}` },
    });
    const proxyResApiAuth = await proxy(proxyReqApiAuth);
    assert(proxyResApiAuth.status === 200, "Proxy allows authenticated requests to proceed");
    assert(
      proxyResApiAuth.headers.get("x-middleware-request-x-user-id") !== null,
      "Proxy injects verified x-user-id header into downstream context"
    );
    assert(
      proxyResApiAuth.headers.get("x-user-id") === null,
      "Proxy does NOT leak raw x-user-id header to outbound client response"
    );
  }

  // ----------------------------------------------------------------------------
  // Test 10: Strict Multi-Tenant Isolation
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 10] Multi-tenant isolation: Tenant A cannot see Tenant B projects");
  {
    // 1. Log in as Tenant A (Pravin @ Spandsons Horizon)
    const loginSpandsons = await loginHandler(
      new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "pravin@spandsons.com", password: TEST_PASSWORDS.pravin }),
      })
    );
    const spandsonsCookie = `${SESSION_COOKIE_NAME}=${loginSpandsons.cookies.get(SESSION_COOKIE_NAME)!.value}`;

    // 2. Log in as Tenant B (Alice @ Acme Aerospace)
    const loginAcme = await loginHandler(
      new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@acme-aero.com", password: TEST_PASSWORDS.alice }),
      })
    );
    const acmeCookie = `${SESSION_COOKIE_NAME}=${loginAcme.cookies.get(SESSION_COOKIE_NAME)!.value}`;

    // Query projects as Spandsons
    const spandsonsProjectsRes = await getProjectsHandler(
      new Request("http://localhost:3000/api/v1/projects", {
        method: "GET",
        headers: { Cookie: spandsonsCookie },
      })
    );
    const spandsonsProjects = await spandsonsProjectsRes.json();

    // Query projects as Acme
    const acmeProjectsRes = await getProjectsHandler(
      new Request("http://localhost:3000/api/v1/projects", {
        method: "GET",
        headers: { Cookie: acmeCookie },
      })
    );
    const acmeProjects = await acmeProjectsRes.json();

    // Verification
    assert(Array.isArray(spandsonsProjects), "Spandsons received projects list");
    assert(Array.isArray(acmeProjects), "Acme received projects list");

    const spandsonsHasAcme = spandsonsProjects.some((p: { name: string }) => p.name.includes("Acme"));
    const acmeHasSpandsons = acmeProjects.some((p: { name: string }) => p.name.includes("Avionics") || p.name.includes("VFD"));

    assert(!spandsonsHasAcme, "Tenant Spandsons CANNOT see Acme Aerospace projects");
    assert(!acmeHasSpandsons, "Tenant Acme CANNOT see Spandsons Horizon projects");

    // Query organization as Acme
    const acmeOrgRes = await getOrgHandler(
      new Request("http://localhost:3000/api/v1/organizations/me", {
        method: "GET",
        headers: { Cookie: acmeCookie },
      })
    );
    const acmeOrg = await acmeOrgRes.json();
    assert(acmeOrg.name === "Acme Aerospace Inc.", "Acme user receives Acme organization details only");
  }

  // ----------------------------------------------------------------------------
  // Test 11: Administrator Provisioning Safety & Guard Enforcement
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 11] Administrator provisioning safety, validation, and override guards");
  const testOverrideEmail = "fixture.override.engineer@spandsons.com";
  const testNewAdminEmail = "fixture.new.admin@spandsons.com";

  try {
    // A. Input validation: invalid email format
    let invalidEmailCaught = false;
    try {
      await provisionAdmin({ email: "invalid-email-string" });
    } catch (err: unknown) {
      invalidEmailCaught = err instanceof Error && err.message.includes("Invalid email address format");
    }
    assert(invalidEmailCaught, "Provisioning rejects malformed email address format");

    // B. Input validation: invalid organization name
    let invalidOrgCaught = false;
    try {
      await provisionAdmin({ email: "valid.ops@spandsons.com", orgName: " " });
    } catch (err: unknown) {
      invalidOrgCaught = err instanceof Error && err.message.includes("Invalid organization name");
    }
    assert(invalidOrgCaught, "Provisioning rejects whitespace-only or empty organization name");

    // C. Safety guard: existing administrator must never be overwritten without explicit authorization
    // Assert expected refusal using the isolated known admin account (pravin@spandsons.com).
    // Do NOT use --force to bypass this safety check; verify the existing admin remains untouched.
    const adminBefore = await db.user.findUnique({
      where: { email: "pravin@spandsons.com" },
    });
    assert(adminBefore !== null && adminBefore.role === "ADMIN", "Known test admin exists with role ADMIN prior to test");

    let adminRefusalCaught = false;
    try {
      await provisionAdmin({
        email: "pravin@spandsons.com",
        orgName: "Hostile Takeover Org",
        name: "Imposter Admin",
        password: "MaliciousPassword123!",
        force: false,
      });
    } catch (err: unknown) {
      adminRefusalCaught = err instanceof Error && err.message.includes("Safety Guard");
    }
    assert(adminRefusalCaught, "Provisioning refuses to modify existing administrator without --force flag");

    // Verify existing administrator was NOT mutated or overwritten
    const adminAfterRefusal = await db.user.findUnique({
      where: { email: "pravin@spandsons.com" },
    });
    assert(adminAfterRefusal !== null, "Administrator record is intact");
    assert(adminAfterRefusal?.role === "ADMIN", "Administrator role remained ADMIN");
    assert(adminAfterRefusal?.name === adminBefore?.name, "Administrator name remained completely unchanged");
    assert(adminAfterRefusal?.passwordHash === adminBefore?.passwordHash, "Administrator password hash remained completely unchanged");
    assert(adminAfterRefusal?.tenantId === adminBefore?.tenantId, "Administrator tenant remained completely unchanged");

    // D. Controlled update with explicit --force using an isolated test fixture account
    // Create dedicated fixture account (role: ENGINEER) to test elevation and credential update
    const tenantSpandsons = await db.tenant.findUnique({ where: { slug: "spandsons-horizon" } });
    assert(tenantSpandsons !== null, "Tenant Spandsons Horizon exists");

    await db.user.upsert({
      where: { email: testOverrideEmail },
      update: { role: "ENGINEER", status: "ACTIVE" },
      create: {
        email: testOverrideEmail,
        name: "Fixture Engineer",
        passwordHash: "$scrypt$initial",
        role: "ENGINEER",
        status: "ACTIVE",
        tenantId: tenantSpandsons!.id,
      },
    });

    // Verify refusal on the fixture user without --force
    let fixtureRefusalCaught = false;
    try {
      await provisionAdmin({
        email: testOverrideEmail,
        force: false,
      });
    } catch (err: unknown) {
      fixtureRefusalCaught = err instanceof Error && err.message.includes("Safety Guard");
    }
    assert(fixtureRefusalCaught, "Provisioning refuses to modify fixture account without --force flag");

    // Elevate with explicit --force
    const forcedResult = await provisionAdmin({
      email: testOverrideEmail,
      password: "UpdatedAdminPassword@2026!",
      force: true,
    });
    assert(forcedResult.action === "updated", "Provisioning reports action: 'updated' when --force is supplied");
    assert(forcedResult.role === "ADMIN", "Returned role reflects elevation to ADMIN");

    const elevatedDbUser = await db.user.findUnique({
      where: { email: testOverrideEmail },
    });
    assert(elevatedDbUser?.role === "ADMIN", "Database record reflects elevated ADMIN role");
    const isNewPasswordValid = await verifyPassword("UpdatedAdminPassword@2026!", elevatedDbUser!.passwordHash);
    assert(isNewPasswordValid, "Updated password authenticates against new database hash");

    // E. Provision new administrator with generated credentials
    const newAdminResult = await provisionAdmin({
      email: testNewAdminEmail,
      name: "Operations Lead",
      orgName: "Spandsons Horizon Engineering Pvt. Ltd.",
    });
    assert(newAdminResult.action === "created", "Provisioning reports action: 'created' for new administrator");
    assert(
      typeof newAdminResult.generatedPassword === "string" && newAdminResult.generatedPassword.length >= 20,
      "Secure temporary password was generated for new administrator"
    );

    const createdDbUser = await db.user.findUnique({
      where: { email: testNewAdminEmail },
    });
    assert(createdDbUser !== null && createdDbUser.role === "ADMIN", "New administrator user created in database");
    const isGenPassValid = await verifyPassword(newAdminResult.generatedPassword!, createdDbUser!.passwordHash);
    assert(isGenPassValid, "Generated temporary password verifies against stored salted hash");
  } finally {
    // Ensure cleanup runs in finally block so test failures do not leave inconsistent test data
    try {
      await db.user.deleteMany({
        where: {
          email: {
            in: [testOverrideEmail, testNewAdminEmail],
          },
        },
      });
      await runSeed();
    } catch (cleanErr) {
      console.warn("[CLEANUP WARNING]", cleanErr);
    }
  }

  // ----------------------------------------------------------------------------
  // Test 12: Cross-Origin / CSRF Protection on Mutating Requests
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 12] Cross-Origin / CSRF Protection on Mutating Requests");
  {
    // Log in as Pravin to get valid session
    const loginRes = await loginHandler(
      new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "pravin@spandsons.com", password: TEST_PASSWORDS.pravin }),
      })
    );
    const validCookie = `${SESSION_COOKIE_NAME}=${loginRes.cookies.get(SESSION_COOKIE_NAME)!.value}`;

    // A. Cross-origin POST request via Proxy is blocked with 403
    const proxyCsrfReq = new NextRequest("http://localhost:3000/api/v1/projects", {
      method: "POST",
      headers: {
        Cookie: validCookie,
        Origin: "https://evil-attacker.example.com",
        "Content-Type": "application/json",
      },
    });
    const proxyCsrfRes = await proxy(proxyCsrfReq);
    assert(proxyCsrfRes.status === 403, "Proxy blocks cross-origin POST request with HTTP 403");

    // B. Cross-origin POST request via Handler is blocked with 403
    const handlerCsrfReq = new Request("http://localhost:3000/api/v1/projects", {
      method: "POST",
      headers: {
        Cookie: validCookie,
        Origin: "https://evil-attacker.example.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Malicious CSRF Project" }),
    });
    const handlerCsrfRes = await createProjectHandler(handlerCsrfReq);
    assert(handlerCsrfRes.status === 403, "API handler blocks cross-origin POST request with HTTP 403");

    // C. Malformed Origin header is rejected with 403
    const malformedOriginReq = new Request("http://localhost:3000/api/v1/projects", {
      method: "POST",
      headers: {
        Cookie: validCookie,
        Origin: "not_a_valid_url://",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Malformed Origin Project" }),
    });
    const malformedOriginRes = await createProjectHandler(malformedOriginReq);
    assert(malformedOriginRes.status === 403, "API handler rejects malformed Origin header with HTTP 403");

    // D. Cross-origin Logout request is blocked with 403
    const logoutCsrfReq = new Request("http://localhost:3000/api/v1/auth/logout", {
      method: "POST",
      headers: {
        Cookie: validCookie,
        Origin: "https://evil-attacker.example.com",
      },
    });
    const logoutCsrfRes = await logoutHandler(logoutCsrfReq);
    assert(logoutCsrfRes.status === 403, "API handler blocks cross-origin logout with HTTP 403");

    // E. Legitimate same-origin request is allowed
    const sameOriginReq = new Request("http://localhost:3000/api/v1/projects", {
      method: "POST",
      headers: {
        Cookie: validCookie,
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Legitimate Same-Origin Project" }),
    });
    const sameOriginRes = await createProjectHandler(sameOriginReq);
    assert(sameOriginRes.status === 201, "API handler allows legitimate same-origin POST request");

    // F. Request without Origin header (local development / programmatic) is allowed
    const noOriginReq = new Request("http://localhost:3000/api/v1/projects", {
      method: "POST",
      headers: {
        Cookie: validCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Programmatic Local Project" }),
    });
    const noOriginRes = await createProjectHandler(noOriginReq);
    assert(noOriginRes.status === 201, "API handler allows legitimate request without Origin header");

    // G. Configured canonical production origin is accepted even when server is behind internal reverse proxy
    const prevAppUrl = process.env.APP_URL;
    try {
      process.env.APP_URL = "https://app.spanqc.com";
      const prodOriginReq = new Request("http://127.0.0.1:3000/api/v1/projects", {
        method: "POST",
        headers: {
          Cookie: validCookie,
          Origin: "https://app.spanqc.com",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Production Canonical Origin Project" }),
      });
      const prodOriginRes = await createProjectHandler(prodOriginReq);
      assert(prodOriginRes.status === 201, "API handler allows configured canonical production origin");

      // H. Spoofed X-Forwarded-Host with untrusted Origin is rejected with 403
      const spoofForwardedReq = new Request("http://127.0.0.1:3000/api/v1/projects", {
        method: "POST",
        headers: {
          Cookie: validCookie,
          Origin: "https://evil-spoof.example.com",
          "X-Forwarded-Host": "evil-spoof.example.com",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Spoofed Forwarded Host Project" }),
      });
      const spoofForwardedRes = await createProjectHandler(spoofForwardedReq);
      assert(spoofForwardedRes.status === 403, "API handler rejects spoofed X-Forwarded-Host with untrusted Origin");

      // I. Sec-Fetch-Site: cross-site is rejected with 403
      const crossSiteMetaReq = new Request("http://localhost:3000/api/v1/projects", {
        method: "POST",
        headers: {
          Cookie: validCookie,
          "Sec-Fetch-Site": "cross-site",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Cross-Site Metadata Project" }),
      });
      const crossSiteMetaRes = await createProjectHandler(crossSiteMetaReq);
      assert(crossSiteMetaRes.status === 403, "API handler rejects Sec-Fetch-Site: cross-site with HTTP 403");

      // J. Sandboxed iframe (Origin: null) is rejected with 403
      const nullOriginReq = new Request("http://localhost:3000/api/v1/projects", {
        method: "POST",
        headers: {
          Cookie: validCookie,
          Origin: "null",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Null Origin Project" }),
      });
      const nullOriginRes = await createProjectHandler(nullOriginReq);
      assert(nullOriginRes.status === 403, "API handler rejects Origin: null with HTTP 403");
    } finally {
      process.env.APP_URL = prevAppUrl;
    }
  }


  // ----------------------------------------------------------------------------
  // Test 13: Role-Based Access Control (RBAC) Enforcement
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 13] Role-Based Access Control (RBAC) Enforcement");
  {
    // A. REVIEWER cannot create projects
    const reviewerLogin = await loginHandler(
      new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "inspector@spandsons.com", password: TEST_PASSWORDS.inspector }),
      })
    );
    const reviewerCookie = `${SESSION_COOKIE_NAME}=${reviewerLogin.cookies.get(SESSION_COOKIE_NAME)!.value}`;

    const reviewerCreateReq = new Request("http://localhost:3000/api/v1/projects", {
      method: "POST",
      headers: {
        Cookie: reviewerCookie,
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Illegal Reviewer Project" }),
    });
    const reviewerCreateRes = await createProjectHandler(reviewerCreateReq);
    assert(reviewerCreateRes.status === 403, "API rejects project creation by REVIEWER role with HTTP 403");
    const reviewerErr = await reviewerCreateRes.json();
    assert(reviewerErr.detail?.includes("Reviewers are not authorized"), "Returns descriptive RBAC rejection detail");

    const illegalProjectInDb = await db.project.findFirst({ where: { name: "Illegal Reviewer Project" } });
    assert(illegalProjectInDb === null, "Verified illegal project was NOT created in the database");

    // B. ENGINEER can create projects
    const engineerLogin = await loginHandler(
      new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "gogulnath@spandsons.com", password: TEST_PASSWORDS.gogulnath }),
      })
    );
    const engineerCookie = `${SESSION_COOKIE_NAME}=${engineerLogin.cookies.get(SESSION_COOKIE_NAME)!.value}`;

    const engineerCreateReq = new Request("http://localhost:3000/api/v1/projects", {
      method: "POST",
      headers: {
        Cookie: engineerCookie,
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Legitimate Engineer Project" }),
    });
    const engineerCreateRes = await createProjectHandler(engineerCreateReq);
    assert(engineerCreateRes.status === 201, "API permits project creation by ENGINEER role with HTTP 201");
  }

  // ----------------------------------------------------------------------------
  // Test 14: Session Invalidation on Password and Role Changes
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 14] Session Invalidation on Password and Role Changes");
  {
    // A. Direct user session revocation
    const gogulUser = await db.user.findUnique({ where: { email: "gogulnath@spandsons.com" } });
    assert(gogulUser !== null, "User gogulnath exists");

    const gogulLogin = await loginHandler(
      new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "gogulnath@spandsons.com", password: TEST_PASSWORDS.gogulnath }),
      })
    );
    const gogulCookie = `${SESSION_COOKIE_NAME}=${gogulLogin.cookies.get(SESSION_COOKIE_NAME)!.value}`;

    // Verify session works initially
    const gogulMeBefore = await getMeHandler(
      new Request("http://localhost:3000/api/v1/auth/me", { headers: { Cookie: gogulCookie } })
    );
    assert(gogulMeBefore.status === 200, "Session is valid initially");

    // Invalidate all sessions for gogulnath
    await revokeAllUserSessions(gogulUser!.id);

    // Verify old session is now rejected
    const gogulMeAfter = await getMeHandler(
      new Request("http://localhost:3000/api/v1/auth/me", { headers: { Cookie: gogulCookie } })
    );
    assert(gogulMeAfter.status === 401, "Session is revoked immediately after revokeAllUserSessions");

    // B. Administrator provisioning script automatically revokes existing sessions
    const aliceUser = await db.user.findUnique({ where: { email: "alice@acme-aero.com" } });
    assert(aliceUser !== null, "User alice exists");

    const aliceLogin = await loginHandler(
      new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@acme-aero.com", password: TEST_PASSWORDS.alice }),
      })
    );
    const aliceCookie = `${SESSION_COOKIE_NAME}=${aliceLogin.cookies.get(SESSION_COOKIE_NAME)!.value}`;

    // Update Alice via provisionAdmin with new password
    await provisionAdmin({
      email: "alice@acme-aero.com",
      password: "AliceBrandNewPass@2026!",
      force: true,
    });

    // Old session must be revoked immediately
    const aliceMeAfterProvision = await getMeHandler(
      new Request("http://localhost:3000/api/v1/auth/me", { headers: { Cookie: aliceCookie } })
    );
    assert(aliceMeAfterProvision.status === 401, "Provisioning script automatically revoked prior active sessions for user");
  }

  // ----------------------------------------------------------------------------
  // Test 15: Immediate Web Proxy Enforcement for Revoked & Suspended Accounts
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 15] Immediate Web Proxy Enforcement for Revoked & Suspended Accounts");
  {
    // Log in as Pravin
    const pravinLogin = await loginHandler(
      new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "pravin@spandsons.com", password: TEST_PASSWORDS.pravin }),
      })
    );
    const pravinCookie = `${SESSION_COOKIE_NAME}=${pravinLogin.cookies.get(SESSION_COOKIE_NAME)!.value}`;

    // A. Active session allows web access via Proxy
    const proxyAllowedReq = new NextRequest("http://localhost:3000/app/projects", {
      headers: { Cookie: pravinCookie },
    });
    const proxyAllowedRes = await proxy(proxyAllowedReq);
    assert(proxyAllowedRes.status === 200, "Proxy allows active session to access /app/projects");

    // Verify outbound response headers do NOT leak internal identity metadata
    assert(proxyAllowedRes.headers.get("x-user-id") === null, "Response does NOT leak x-user-id header");
    assert(proxyAllowedRes.headers.get("x-tenant-id") === null, "Response does NOT leak x-tenant-id header");
    assert(proxyAllowedRes.headers.get("x-user-role") === null, "Response does NOT leak x-user-role header");
    assert(proxyAllowedRes.headers.get("x-user-email") === null, "Response does NOT leak x-user-email header");

    // Revoke Pravin's session in DB via logout
    await logoutHandler(
      new Request("http://localhost:3000/api/v1/auth/logout", {
        method: "POST",
        headers: { Cookie: pravinCookie },
      })
    );

    // B. Proxy rejects revoked session and redirects to /login (does NOT rely on HMAC alone)
    const proxyRevokedReq = new NextRequest("http://localhost:3000/app/projects", {
      headers: { Cookie: pravinCookie },
    });
    const proxyRevokedRes = await proxy(proxyRevokedReq);
    assert(proxyRevokedRes.status === 307, "Proxy immediately redirects revoked session to /login (does not trust HMAC alone)");
    assert(proxyRevokedRes.headers.get("location")?.includes("/login") === true, "Redirect location is /login");

    // C. Suspended user is blocked from web and API routes immediately
    const spandsonsTenant = await db.tenant.findUnique({ where: { slug: "spandsons-horizon" } });
    const suspendedUser = await db.user.create({
      data: {
        email: "suspended.temp@spandsons.com",
        name: "Suspended User",
        passwordHash: "$scrypt$temp",
        role: "ENGINEER",
        status: "SUSPENDED",
        tenantId: spandsonsTenant!.id,
      },
    });

    const suspendedPayload = {
      userId: suspendedUser.id,
      tenantId: spandsonsTenant!.id,
      role: suspendedUser.role,
      email: suspendedUser.email,
      sessionId: "sess-suspended-test",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const suspendedToken = signSessionToken(suspendedPayload);
    // Create DB session for suspended user
    await db.session.create({
      data: {
        id: "sess-suspended-test",
        tokenHash: hashToken(suspendedToken),
        userId: suspendedUser.id,
        tenantId: spandsonsTenant!.id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const suspendedCookie = `${SESSION_COOKIE_NAME}=${suspendedToken}`;

    // Web request via Proxy
    const proxySuspendedReq = new NextRequest("http://localhost:3000/app/projects", {
      headers: { Cookie: suspendedCookie },
    });
    const proxySuspendedRes = await proxy(proxySuspendedReq);
    assert(proxySuspendedRes.status === 307, "Proxy immediately blocks suspended user and redirects to /login");

    // API request via Handler
    const apiSuspendedReq = new Request("http://localhost:3000/api/v1/auth/me", {
      headers: { Cookie: suspendedCookie },
    });
    const apiSuspendedRes = await getMeHandler(apiSuspendedReq);
    assert(apiSuspendedRes.status === 401, "API handler rejects suspended user with HTTP 401");

    // Clean up suspended temp user
    await db.session.deleteMany({ where: { userId: suspendedUser.id } });
    await db.user.delete({ where: { id: suspendedUser.id } });
    await runSeed();
  }

  // ----------------------------------------------------------------------------
  // Test 16: Bearer Token Authentication Compatibility and CSRF Non-Imposition
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 16] Bearer Token Authentication Compatibility and CSRF Non-Imposition");
  {
    // Log in as Pravin (Admin) to get session token
    const loginRes = await loginHandler(
      new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "pravin@spandsons.com", password: TEST_PASSWORDS.pravin }),
      })
    );
    const loginData = await loginRes.json();
    const bearerToken = loginData.tokens.access_token as string;
    assert(typeof bearerToken === "string" && bearerToken.length > 0, "Obtained valid Bearer token from login");

    // A. Proxy allows valid Bearer token to access /api/v1/projects without cookies
    const proxyBearerReq = new NextRequest("http://localhost:3000/api/v1/projects", {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    });
    const proxyBearerRes = await proxy(proxyBearerReq);
    assert(proxyBearerRes.status === 200, "Proxy allows valid Bearer token to access /api/v1/projects");

    // B. API handler allows Bearer token to create project without cookie CSRF requirement
    // Even if Origin is from a different domain, Bearer tokens are not ambient credentials
    const handlerBearerReq = new Request("http://localhost:3000/api/v1/projects", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Origin: "https://external-client.example.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Bearer Authenticated Project" }),
    });
    const handlerBearerRes = await createProjectHandler(handlerBearerReq);
    assert(handlerBearerRes.status === 201, "API handler permits mutation via Bearer token without cookie CSRF checks");

    // C. Proxy rejects empty Bearer token with 401
    const proxyEmptyBearerReq = new NextRequest("http://localhost:3000/api/v1/projects", {
      headers: {
        Authorization: "Bearer ",
      },
    });
    const proxyEmptyBearerRes = await proxy(proxyEmptyBearerReq);
    assert(proxyEmptyBearerRes.status === 401, "Proxy rejects empty Bearer token with HTTP 401");

    // D. API handler rejects malformed Bearer token with 401
    const handlerBadBearerReq = new Request("http://localhost:3000/api/v1/projects", {
      headers: {
        Authorization: "Bearer invalid.signature.token",
      },
    });
    const handlerBadBearerRes = await getProjectsHandler(handlerBadBearerReq);
    assert(handlerBadBearerRes.status === 401, "API handler rejects invalid Bearer token with HTTP 401");

    // E. Requests with both Cookie and Bearer: if Cookie is present, CSRF is still enforced
    const validCookie = `${SESSION_COOKIE_NAME}=${loginRes.cookies.get(SESSION_COOKIE_NAME)!.value}`;
    const dualAuthCsrfReq = new Request("http://localhost:3000/api/v1/projects", {
      method: "POST",
      headers: {
        Cookie: validCookie,
        Authorization: `Bearer ${bearerToken}`,
        Origin: "https://evil-cross-origin.example.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Illegal Dual Auth CSRF Project" }),
    });
    const dualAuthCsrfRes = await createProjectHandler(dualAuthCsrfReq);
    assert(dualAuthCsrfRes.status === 403, "Requests with ambient cookie still enforce CSRF even if Bearer is provided");
  }


  console.log("\n================================================================================");
  console.log(`TEST SUITE COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .catch((err) => {
    console.error("[FATAL ERROR IN TEST SUITE]", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
