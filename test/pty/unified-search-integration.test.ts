import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createPtyHarness, REVIEW_MENU_BAR } from "./harness";

const harness = createPtyHarness();
setDefaultTimeout(40_000);

afterEach(() => {
  harness.cleanup();
});

/** Unchanged lines around one change, so the source holds lines the diff does not show. */
function sourceTestLines(changed: string) {
  const lines = Array.from({ length: 40 }, (_, index) => `const filler${index} = ${index};`);
  lines[1] = "const SPOT = 1; // SPOT";
  lines[20] = changed;
  lines[38] = "const FAR_AWAY = 38;";
  return `${lines.join("\n")}\n`;
}

describe("PTY unified search", () => {
  test("/ opens one search; Tab switches all source and diff only; n steps the hits", async () => {
    const { dir } = harness.createGitRepoFixture([
      {
        path: "alpha.ts",
        before: sourceTestLines("const changed = 1;"),
        after: sourceTestLines("const changed = 2; // SPOT"),
      },
    ]);
    const session = await harness.launchHunk({ args: ["diff"], cwd: dir, cols: 140, rows: 30 });

    try {
      await session.waitForText(REVIEW_MENU_BAR, { timeout: 15_000 });
      await session.waitForText(/changed = 2/, { timeout: 15_000 });

      // Diff only: FAR_AWAY sits in unchanged code no hunk carries.
      await session.type("/");
      await session.waitForText(/Search all source \(tab switches\)/, { timeout: 5_000 });
      await session.press("tab");
      await session.waitForText(/Search diff only \(tab switches\)/, { timeout: 5_000 });
      await session.type("FAR_AWAY");
      await session.press("enter");
      await session.waitForText(/Search diff only: FAR_AWAY\s+no hits/, { timeout: 5_000 });

      // The scope outlives the search; Tab back to all source finds it.
      await session.press("escape");
      await session.type("/");
      await session.waitForText(/Search diff only \(tab switches\)/, { timeout: 5_000 });
      await session.press("tab");
      await session.type("FAR_AWAY");
      await session.press("enter");
      await session.waitForText(/Search all source: FAR_AWAY\s+1\/1 hits/, { timeout: 5_000 });

      // n steps to the next hit of a query with three of them.
      await session.press("escape");
      await session.type("/");
      await session.type("SPOT");
      await session.press("enter");
      await session.waitForText(/1\/3 hits/, { timeout: 5_000 });
      await session.type("n");
      await session.waitForText(/2\/3 hits/, { timeout: 5_000 });
      await session.type("N");
      const screen = await session.waitForText(/1\/3 hits/, { timeout: 5_000 });
      expect(screen).toContain("Search all source: SPOT");
    } finally {
      session.close();
    }
  });
});
