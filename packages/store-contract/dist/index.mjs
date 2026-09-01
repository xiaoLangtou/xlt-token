import { describe, expect, it } from "vitest";
import { finiteTtl, keepTtl, persistentTtl } from "@xlt-token/core";

//#region src/store-contract.ts
function defineStoreContract(name, createStore) {
	describe(name, () => {
		it("keeps one winner for concurrent setIfAbsent", async () => {
			const store = await createStore();
			expect((await Promise.all(Array.from({ length: 20 }, (_, index) => store.setIfAbsent("{contract}:lock", String(index), finiteTtl(30))))).filter(Boolean)).toHaveLength(1);
			await expect(store.get("{contract}:lock")).resolves.toMatchObject({ value: expect.any(String) });
		});
		it("returns and deletes the entry in one atomic operation", async () => {
			const store = await createStore();
			await store.set("{contract}:consume", "v1", finiteTtl(60));
			await expect(store.getAndDelete("{contract}:consume")).resolves.toMatchObject({ value: "v1" });
			await expect(store.getAndDelete("{contract}:consume")).resolves.toBeNull();
			await expect(store.get("{contract}:consume")).resolves.toBeNull();
		});
		it("returns null when getAndDelete misses", async () => {
			await expect((await createStore()).getAndDelete("{contract}:consume-missing")).resolves.toBeNull();
		});
		it("keeps one winner for concurrent getAndDelete", async () => {
			const store = await createStore();
			await store.set("{contract}:consume-race", "v1", persistentTtl());
			const winners = (await Promise.all(Array.from({ length: 20 }, () => store.getAndDelete("{contract}:consume-race")))).filter((entry) => entry !== null);
			expect(winners).toHaveLength(1);
			expect(winners[0]).toMatchObject({ value: "v1" });
			await expect(store.get("{contract}:consume-race")).resolves.toBeNull();
		});
		it("keeps value and ttl unchanged when compareAndSet misses", async () => {
			const store = await createStore();
			await store.set("{contract}:cas", "v1", finiteTtl(60));
			await expect(store.compareAndSet("{contract}:cas", "wrong", "v2", keepTtl())).resolves.toBe(false);
			await expect(store.get("{contract}:cas")).resolves.toMatchObject({ value: "v1" });
		});
		it("updates and deletes only when the current value matches", async () => {
			const store = await createStore();
			await store.set("{contract}:mutable", "v1", persistentTtl());
			await expect(store.compareAndSet("{contract}:mutable", "v1", "v2", keepTtl())).resolves.toBe(true);
			await expect(store.get("{contract}:mutable")).resolves.toMatchObject({ value: "v2" });
			await expect(store.compareAndDelete("{contract}:mutable", "wrong")).resolves.toBe(false);
			await expect(store.compareAndDelete("{contract}:mutable", "v2")).resolves.toBe(true);
			await expect(store.get("{contract}:mutable")).resolves.toBeNull();
		});
		it("touches ttl without changing value", async () => {
			const store = await createStore();
			await store.set("{contract}:touch", "v1", finiteTtl(30));
			await expect(store.touch("{contract}:touch", persistentTtl())).resolves.toBe(true);
			await expect(store.get("{contract}:touch")).resolves.toMatchObject({
				value: "v1",
				expiresAt: null
			});
		});
	});
}

//#endregion
export { defineStoreContract };
//# sourceMappingURL=index.mjs.map