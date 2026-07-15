import type { Secret, SignOptions } from "jsonwebtoken";

export type JwtAlgorithm = Extract<
  SignOptions["algorithm"],
  "HS256" | "HS384" | "HS512" | "RS256" | "RS384" | "RS512" | "ES256" | "ES384" | "ES512"
>;

export interface JwtKeyInput {
  kid: string;
  algorithm: JwtAlgorithm;
  secret?: Secret;
  signingKey?: Secret;
  verificationKey?: Secret;
}

export interface JwtKey {
  kid: string;
  algorithm: JwtAlgorithm;
  signingKey: Secret;
  verificationKey: Secret;
}

export type JwtAudience = string | [string, ...string[]];

export interface JwtStrategyConfigInput {
  activeKid: string;
  keys: JwtKeyInput[];
  issuer?: string;
  audience?: JwtAudience;
}

export interface JwtStrategyConfig {
  activeKid: string;
  activeKey: JwtKey;
  keys: ReadonlyMap<string, JwtKey>;
  issuer?: string;
  audience?: JwtAudience;
}

const supportedAlgorithms = new Set<JwtAlgorithm>([
  "HS256",
  "HS384",
  "HS512",
  "RS256",
  "RS384",
  "RS512",
  "ES256",
  "ES384",
  "ES512",
]);

export function createJwtStrategyConfig(input: JwtStrategyConfigInput): JwtStrategyConfig {
  if (!input.activeKid) {
    throw new Error("JWT activeKid is required");
  }
  if (!input.keys.length) {
    throw new Error("JWT keys must not be empty");
  }

  const keys = new Map<string, JwtKey>();
  for (const keyInput of input.keys) {
    const key = normalizeJwtKey(keyInput);
    if (keys.has(key.kid)) {
      throw new Error(`JWT key kid "${key.kid}" is duplicated`);
    }
    keys.set(key.kid, key);
  }

  const activeKey = keys.get(input.activeKid);
  if (!activeKey) {
    throw new Error(`JWT activeKid "${input.activeKid}" does not match any configured key`);
  }

  return {
    activeKid: input.activeKid,
    activeKey,
    keys,
    issuer: input.issuer,
    audience: input.audience,
  };
}

function normalizeJwtKey(input: JwtKeyInput): JwtKey {
  if (!input.kid) {
    throw new Error("JWT key kid is required");
  }
  if (!supportedAlgorithms.has(input.algorithm)) {
    throw new Error(`JWT algorithm "${input.algorithm}" is not supported`);
  }

  const signingKey = input.signingKey ?? input.secret;
  const verificationKey = input.verificationKey ?? input.secret ?? input.signingKey;
  if (!signingKey || !verificationKey) {
    throw new Error(`JWT key "${input.kid}" requires signing and verification keys`);
  }
  if (input.algorithm.startsWith("HS")) {
    assertStrongHmacSecret(input.kid, signingKey);
  }

  return {
    kid: input.kid,
    algorithm: input.algorithm,
    signingKey,
    verificationKey,
  };
}

function assertStrongHmacSecret(kid: string, secret: Secret): void {
  const length =
    typeof secret === "string"
      ? Buffer.byteLength(secret)
      : Buffer.isBuffer(secret)
        ? secret.byteLength
        : 0;

  if (length < 32) {
    throw new Error(`JWT key "${kid}" uses a weak HMAC secret; use at least 32 bytes`);
  }
}
