Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
let vitest = require("vitest");
let _xlt_token_core = require("@xlt-token/core");

//#region src/store-contract.ts
function defineStoreContract(name, createStore) {
	(0, vitest.describe)(name, () => {
		(0, vitest.it)("keeps one winner for concurrent setIfAbsent", async () => {
			const store = await createStore();
			(0, vitest.expect)((await Promise.all(Array.from({ length: 20 }, (_, index) => store.setIfAbsent("{contract}:lock", String(index), (0, _xlt_token_core.finiteTtl)(30))))).filter(Boolean)).toHaveLength(1);
			await (0, vitest.expect)(store.get("{contract}:lock")).resolves.toMatchObject({ value: vitest.expect.any(String) });
		});
		(0, vitest.it)("keeps value and ttl unchanged when compareAndSet misses", async () => {
			const store = await createStore();
			await store.set("{contract}:cas", "v1", (0, _xlt_token_core.finiteTtl)(60));
			await (0, vitest.expect)(store.compareAndSet("{contract}:cas", "wrong", "v2", (0, _xlt_token_core.keepTtl)())).resolves.toBe(false);
			await (0, vitest.expect)(store.get("{contract}:cas")).resolves.toMatchObject({ value: "v1" });
		});
		(0, vitest.it)("updates and deletes only when the current value matches", async () => {
			const store = await createStore();
			await store.set("{contract}:mutable", "v1", (0, _xlt_token_core.persistentTtl)());
			await (0, vitest.expect)(store.compareAndSet("{contract}:mutable", "v1", "v2", (0, _xlt_token_core.keepTtl)())).resolves.toBe(true);
			await (0, vitest.expect)(store.get("{contract}:mutable")).resolves.toMatchObject({ value: "v2" });
			await (0, vitest.expect)(store.compareAndDelete("{contract}:mutable", "wrong")).resolves.toBe(false);
			await (0, vitest.expect)(store.compareAndDelete("{contract}:mutable", "v2")).resolves.toBe(true);
			await (0, vitest.expect)(store.get("{contract}:mutable")).resolves.toBeNull();
		});
		(0, vitest.it)("touches ttl without changing value", async () => {
			const store = await createStore();
			await store.set("{contract}:touch", "v1", (0, _xlt_token_core.finiteTtl)(30));
			await (0, vitest.expect)(store.touch("{contract}:touch", (0, _xlt_token_core.persistentTtl)())).resolves.toBe(true);
			await (0, vitest.expect)(store.get("{contract}:touch")).resolves.toMatchObject({
				value: "v1",
				expiresAt: null
			});
		});
	});
}

//#endregion
exports.defineStoreContract = defineStoreContract;