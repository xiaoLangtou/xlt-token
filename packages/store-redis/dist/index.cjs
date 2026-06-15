Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

//#region src/redis-store.ts
var RedisStore = class {
	constructor(redisClient) {
		this.redisClient = redisClient;
	}
	async get(key) {
		return this.redisClient.get(key);
	}
	async set(key, value, timeoutSec) {
		if (timeoutSec === -1) {
			await this.redisClient.set(key, value);
			return;
		}
		await this.redisClient.set(key, value, { EX: timeoutSec });
	}
	async delete(key) {
		await this.redisClient.del(key);
	}
	async update(key, value) {
		if (await this.redisClient.set(key, value, {
			XX: true,
			KEEPTTL: true
		}) === null) throw new Error(`Key not found: ${key}`);
	}
	async has(key) {
		return await this.redisClient.exists(key) === 1;
	}
	async updateTimeout(key, timeoutSec) {
		if (!await this.redisClient.exists(key)) throw new Error(`Key not found: ${key}`);
		if (timeoutSec === -1) {
			await this.redisClient.persist(key);
			return;
		}
		await this.redisClient.expire(key, timeoutSec);
	}
	async getTimeout(key) {
		return this.redisClient.ttl(key);
	}
	async keys(pattern) {
		const result = [];
		let cursor = "0";
		do {
			const reply = await this.redisClient.scan(cursor, {
				MATCH: pattern,
				COUNT: 100
			});
			cursor = String(reply.cursor);
			result.push(...reply.keys);
		} while (cursor !== "0");
		return result;
	}
};

//#endregion
//#region src/ioredis-store.ts
var IORedisStore = class {
	constructor(redisClient) {
		this.redisClient = redisClient;
	}
	async get(key) {
		return this.redisClient.get(key);
	}
	async set(key, value, timeoutSec) {
		if (timeoutSec === -1) {
			await this.redisClient.set(key, value);
			return;
		}
		await this.redisClient.set(key, value, "EX", timeoutSec);
	}
	async delete(key) {
		await this.redisClient.del(key);
	}
	async update(key, value) {
		if (await this.redisClient.set(key, value, "XX", "KEEPTTL") === null) throw new Error(`Key not found: ${key}`);
	}
	async has(key) {
		return await this.redisClient.exists(key) === 1;
	}
	async updateTimeout(key, timeoutSec) {
		if (!await this.redisClient.exists(key)) throw new Error(`Key not found: ${key}`);
		if (timeoutSec === -1) {
			await this.redisClient.persist(key);
			return;
		}
		await this.redisClient.expire(key, timeoutSec);
	}
	async getTimeout(key) {
		return this.redisClient.ttl(key);
	}
	async keys(pattern) {
		const result = [];
		const clients = this.redisClient.nodes?.("master") ?? [this.redisClient];
		for (const client of clients) {
			let cursor = "0";
			do {
				const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
				cursor = nextCursor;
				result.push(...keys);
			} while (cursor !== "0");
		}
		return result;
	}
};

//#endregion
exports.IORedisStore = IORedisStore;
exports.RedisStore = RedisStore;