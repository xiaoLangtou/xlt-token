import { randomUUID } from "node:crypto";
import { decode, sign, verify } from "jsonwebtoken";

//#region src/jwt-config.ts
const supportedAlgorithms = new Set([
	"HS256",
	"HS384",
	"HS512",
	"RS256",
	"RS384",
	"RS512",
	"ES256",
	"ES384",
	"ES512"
]);
function createJwtStrategyConfig(input) {
	if (!input.activeKid) throw new Error("JWT activeKid is required");
	if (!input.keys.length) throw new Error("JWT keys must not be empty");
	const keys = /* @__PURE__ */ new Map();
	for (const keyInput of input.keys) {
		const key = normalizeJwtKey(keyInput);
		if (keys.has(key.kid)) throw new Error(`JWT key kid "${key.kid}" is duplicated`);
		keys.set(key.kid, key);
	}
	const activeKey = keys.get(input.activeKid);
	if (!activeKey) throw new Error(`JWT activeKid "${input.activeKid}" does not match any configured key`);
	return {
		activeKid: input.activeKid,
		activeKey,
		keys,
		issuer: input.issuer,
		audience: input.audience
	};
}
function normalizeJwtKey(input) {
	if (!input.kid) throw new Error("JWT key kid is required");
	if (!supportedAlgorithms.has(input.algorithm)) throw new Error(`JWT algorithm "${input.algorithm}" is not supported`);
	const signingKey = input.signingKey ?? input.secret;
	const verificationKey = input.verificationKey ?? input.secret ?? input.signingKey;
	if (!signingKey || !verificationKey) throw new Error(`JWT key "${input.kid}" requires signing and verification keys`);
	if (input.algorithm.startsWith("HS")) assertStrongHmacSecret(input.kid, signingKey);
	return {
		kid: input.kid,
		algorithm: input.algorithm,
		signingKey,
		verificationKey
	};
}
function assertStrongHmacSecret(kid, secret) {
	if ((typeof secret === "string" ? Buffer.byteLength(secret) : Buffer.isBuffer(secret) ? secret.byteLength : 0) < 32) throw new Error(`JWT key "${kid}" uses a weak HMAC secret; use at least 32 bytes`);
}

//#endregion
//#region src/jwt-strategy.ts
var JwtStrategy = class {
	constructor(jwtConfig) {
		this.jwtConfig = jwtConfig;
		this.kind = "jwt";
	}
	createToken(loginId, config, options) {
		const jti = randomUUID();
		const expiresIn = resolveExpiresIn(options?.timeout ?? config.timeout);
		return this.signPayload({
			sub: loginId,
			jti
		}, expiresIn);
	}
	generateToken(payload) {
		return this.signPayload(payload);
	}
	verifyToken(token) {
		const decoded = decode(token, { complete: true });
		if (!decoded || typeof decoded === "string") throw new Error("JWT token is malformed");
		const { kid, alg } = decoded.header;
		if (!kid) throw new Error("JWT token header is missing kid");
		const key = this.jwtConfig.keys.get(kid);
		if (!key) throw new Error(`JWT key "${kid}" is not configured`);
		if (alg !== key.algorithm) throw new Error(`JWT algorithm "${String(alg)}" does not match configured key algorithm`);
		const payload = verify(token, key.verificationKey, {
			algorithms: [key.algorithm],
			...this.jwtConfig.issuer && { issuer: this.jwtConfig.issuer },
			...this.jwtConfig.audience && { audience: this.jwtConfig.audience }
		});
		if (typeof payload === "string") throw new Error("JWT payload must be an object");
		if (typeof payload.sub !== "string" || typeof payload.jti !== "string") throw new Error("JWT payload requires string sub and jti claims");
		return payload;
	}
	signPayload(payload, expiresIn) {
		const key = this.jwtConfig.activeKey;
		const options = {
			algorithm: key.algorithm,
			keyid: key.kid,
			...this.jwtConfig.issuer && { issuer: this.jwtConfig.issuer },
			...this.jwtConfig.audience && { audience: this.jwtConfig.audience },
			...expiresIn !== void 0 && { expiresIn }
		};
		return sign(payload, signingKeyFor(key), options);
	}
};
function resolveExpiresIn(timeout) {
	if (typeof timeout === "number" && timeout <= 0) return;
	return timeout;
}
function signingKeyFor(key) {
	return key.signingKey;
}

//#endregion
export { JwtStrategy, createJwtStrategyConfig };
//# sourceMappingURL=index.mjs.map