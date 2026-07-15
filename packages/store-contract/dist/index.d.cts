import { XltTokenStore } from "@xlt-token/core";

//#region src/store-contract.d.ts
declare function defineStoreContract(name: string, createStore: () => Promise<XltTokenStore> | XltTokenStore): void;
//#endregion
export { defineStoreContract };
//# sourceMappingURL=index.d.cts.map