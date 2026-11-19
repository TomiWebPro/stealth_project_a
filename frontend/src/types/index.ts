/**
 * Public type surface for the Studio Platform API.
 *
 * Every module here mirrors a file in backend/app/schemas. Parity is verified
 * by backend/tests/test_contract_parity.py — do not change one side without
 * the other.
 */

export * from "./common";
export * from "./activity";
export * from "./audit";
export * from "./auth";
export * from "./projectStats";
export * from "./conversation";
export * from "./conversationStats";
export * from "./asset";
export * from "./assetStats";
export * from "./operation";
export * from "./provider";
export * from "./orchestration";
export * from "./search";
export * from "./dashboard";
export * from "./tags";
export * from "./impact";
export * from "./providerStats";
export * from "./extensionStats";
export * from "./operationStats";
