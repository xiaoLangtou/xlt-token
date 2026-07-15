Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

//#region src/redis-store.ts
var RedisStore = class {
	constructor(redisClient) {
		this.redisClient = redisClient;
	}
	async get(key) {
		const value = await this.redisClient.get(key);
		if (value === null) return null;
		const ttl = await this.redisClient.ttl(key);
		return {
			value,
			expiresAt: ttl < 0 ? null : Date.now() + ttl * 1e3
		};
	}
	async set(key, value, ttl) {
		if (ttl.kind === "persistent") {
			await this.redisClient.set(key, value);
			return;
		}
		await this.redisClient.set(key, value, { EX: ttl.seconds });
	}
	async delete(key) {
		await this.redisClient.del(key);
	}
	async setIfAbsent(key, value, ttl) {
		if (ttl.kind === "persistent") return await this.redisClient.set(key, value, { NX: true }) === "OK";
		return await this.redisClient.set(key, value, {
			EX: ttl.seconds,
			NX: true
		}) === "OK";
	}
	async compareAndSet(key, expectedValue, nextValue, ttl) {
		return Number(await this.redisClient.eval(COMPARE_AND_MUTATE_SCRIPT$1, {
			keys: [key],
			arguments: this.mutationArguments(expectedValue, nextValue, ttl)
		})) === 1;
	}
	async compareAndDelete(key, expectedValue) {
		return Number(await this.redisClient.eval(COMPARE_AND_MUTATE_SCRIPT$1, {
			keys: [key],
			arguments: [
				expectedValue,
				"",
				"delete",
				""
			]
		})) === 1;
	}
	async touch(key, ttl) {
		return Number(await this.redisClient.eval(TOUCH_SCRIPT$1, {
			keys: [key],
			arguments: ttl.kind === "persistent" ? ["persistent", ""] : ["finite", String(ttl.seconds)]
		})) === 1;
	}
	async scan(pattern, options = {}) {
		const cursor = options.cursor ?? "0";
		const count = options.count ?? 100;
		const reply = await this.redisClient.scan(cursor, {
			MATCH: pattern,
			COUNT: count
		});
		const nextCursor = String(reply.cursor);
		return {
			keys: reply.keys,
			cursor: nextCursor === "0" ? null : nextCursor
		};
	}
	mutationArguments(expectedValue, nextValue, ttl) {
		if (ttl.kind === "keep") return [
			expectedValue,
			nextValue,
			"keep",
			""
		];
		if (ttl.kind === "persistent") return [
			expectedValue,
			nextValue,
			"persistent",
			""
		];
		return [
			expectedValue,
			nextValue,
			"finite",
			String(ttl.seconds)
		];
	}
};
const COMPARE_AND_MUTATE_SCRIPT$1 = `
if redis.call("GET", KEYS[1]) ~= ARGV[1] then
  return 0
end
if ARGV[3] == "delete" then
  redis.call("DEL", KEYS[1])
elseif ARGV[3] == "keep" then
  redis.call("SET", KEYS[1], ARGV[2], "KEEPTTL")
elseif ARGV[3] == "persistent" then
  redis.call("SET", KEYS[1], ARGV[2])
else
  redis.call("SET", KEYS[1], ARGV[2], "EX", tonumber(ARGV[4]))
end
return 1
`;
const TOUCH_SCRIPT$1 = `
if redis.call("EXISTS", KEYS[1]) == 0 then
  return 0
end
if ARGV[1] == "persistent" then
  redis.call("PERSIST", KEYS[1])
else
  redis.call("EXPIRE", KEYS[1], tonumber(ARGV[2]))
end
return 1
`;

//#endregion
//#region src/ioredis-store.ts
var IORedisStore = class {
	constructor(redisClient) {
		this.redisClient = redisClient;
	}
	async get(key) {
		const value = await this.redisClient.get(key);
		if (value === null) return null;
		const ttl = await this.redisClient.ttl(key);
		return {
			value,
			expiresAt: ttl < 0 ? null : Date.now() + ttl * 1e3
		};
	}
	async set(key, value, ttl) {
		if (ttl.kind === "persistent") {
			await this.redisClient.set(key, value);
			return;
		}
		await this.redisClient.set(key, value, "EX", ttl.seconds);
	}
	async delete(key) {
		await this.redisClient.del(key);
	}
	async setIfAbsent(key, value, ttl) {
		if (ttl.kind === "persistent") return await this.redisClient.set(key, value, "NX") === "OK";
		return await this.redisClient.set(key, value, "NX", "EX", ttl.seconds) === "OK";
	}
	async compareAndSet(key, expectedValue, nextValue, ttl) {
		return Number(await this.redisClient.eval(COMPARE_AND_MUTATE_SCRIPT, 1, key, ...this.mutationArguments(expectedValue, nextValue, ttl))) === 1;
	}
	async compareAndDelete(key, expectedValue) {
		return Number(await this.redisClient.eval(COMPARE_AND_MUTATE_SCRIPT, 1, key, expectedValue, "", "delete", "")) === 1;
	}
	async touch(key, ttl) {
		const args = ttl.kind === "persistent" ? ["persistent", ""] : ["finite", String(ttl.seconds)];
		return Number(await this.redisClient.eval(TOUCH_SCRIPT, 1, key, ...args)) === 1;
	}
	async scan(pattern, options = {}) {
		const clusterClients = this.redisClient.nodes?.("master");
		const clients = clusterClients ?? [this.redisClient];
		const isCluster = clusterClients !== void 0;
		const parsedCursor = this.parseClusterCursor(options.cursor);
		const [nextCursor, keys] = await (clients[parsedCursor.clientIndex] ?? clients[0]).scan(parsedCursor.cursor, "MATCH", pattern, "COUNT", options.count ?? 100);
		if (nextCursor !== "0") return {
			keys,
			cursor: isCluster ? `${parsedCursor.clientIndex}:${nextCursor}` : nextCursor
		};
		const nextClientIndex = parsedCursor.clientIndex + 1;
		return {
			keys,
			cursor: isCluster && nextClientIndex < clients.length ? `${nextClientIndex}:0` : null
		};
	}
	parseClusterCursor(cursor) {
		if (!cursor) return {
			clientIndex: 0,
			cursor: "0"
		};
		const [clientIndex, redisCursor] = cursor.includes(":") ? cursor.split(":") : ["0", cursor];
		return {
			clientIndex: Number(clientIndex),
			cursor: redisCursor ?? "0"
		};
	}
	mutationArguments(expectedValue, nextValue, ttl) {
		if (ttl.kind === "keep") return [
			expectedValue,
			nextValue,
			"keep",
			""
		];
		if (ttl.kind === "persistent") return [
			expectedValue,
			nextValue,
			"persistent",
			""
		];
		return [
			expectedValue,
			nextValue,
			"finite",
			String(ttl.seconds)
		];
	}
};
const COMPARE_AND_MUTATE_SCRIPT = `
if redis.call("GET", KEYS[1]) ~= ARGV[1] then
  return 0
end
if ARGV[3] == "delete" then
  redis.call("DEL", KEYS[1])
elseif ARGV[3] == "keep" then
  redis.call("SET", KEYS[1], ARGV[2], "KEEPTTL")
elseif ARGV[3] == "persistent" then
  redis.call("SET", KEYS[1], ARGV[2])
else
  redis.call("SET", KEYS[1], ARGV[2], "EX", tonumber(ARGV[4]))
end
return 1
`;
const TOUCH_SCRIPT = `
if redis.call("EXISTS", KEYS[1]) == 0 then
  return 0
end
if ARGV[1] == "persistent" then
  redis.call("PERSIST", KEYS[1])
else
  redis.call("EXPIRE", KEYS[1], tonumber(ARGV[2]))
end
return 1
`;

//#endregion
exports.IORedisStore = IORedisStore;
exports.RedisStore = RedisStore;