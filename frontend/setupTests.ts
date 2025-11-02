import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";

const matchersModule = await import("@testing-library/jest-dom/matchers");

const { default: defaultMatchers, ...namedMatchers } = matchersModule as {
  default?: Record<string, unknown>;
} & Record<string, unknown>;

expect.extend({
  ...(defaultMatchers ?? {}),
  ...namedMatchers,
} as Record<string, (...args: unknown[]) => unknown>);

afterEach(() => {
  cleanup();
});

if (typeof globalThis.crypto === "undefined") {
  // Provide a minimal crypto implementation for components that rely on randomUUID.
  const nodeCrypto = await import("node:crypto");
  globalThis.crypto = {
    randomUUID: () => nodeCrypto.randomUUID(),
  } as Crypto;
} else if (typeof globalThis.crypto.randomUUID !== "function") {
  const nodeCrypto = await import("node:crypto");
  globalThis.crypto.randomUUID = () => nodeCrypto.randomUUID();
}
