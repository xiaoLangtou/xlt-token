import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const auditEventSource = read("packages/core/src/events/xlt-audit-event.ts");
const stpLogicSource = read("packages/core/src/auth/stp-logic.ts");

const eventBody = auditEventSource.match(/export interface XltAuditEvent \{([\s\S]*?)\n\}/)?.[1];
if (!eventBody) {
  fail("Cannot locate XltAuditEvent interface.");
}

const forbiddenEventFields = [
  "token",
  "rawToken",
  "accessToken",
  "refreshToken",
  "jwt",
  "jwtPayload",
  "payload",
  "request",
  "response",
  "headers",
  "cookies",
  "authorization",
];

for (const field of forbiddenEventFields) {
  const fieldPattern = new RegExp(`\\b${field}\\??\\s*:`);
  if (fieldPattern.test(eventBody)) {
    fail(`XltAuditEvent must not expose sensitive field "${field}". Use fingerprints only.`);
  }
}

if (
  !/function fingerprintToken\(token: string\): string \{\s*return createHash\("sha256"\)\.update\(token\)\.digest\("hex"\)\.slice\(0, 16\);/m.test(
    stpLogicSource,
  )
) {
  fail("Token audit fingerprints must use sha256(token).hex.slice(0, 16).");
}

if (/config\.jwt|JwtConfig|jwt\?:/.test(read("packages/core/src/config/xlt-token-config.ts"))) {
  fail("Core config must not expose legacy jwt.secret configuration.");
}

console.log("Security invariant check passed.");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
