import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createPtyHarness, REVIEW_MENU_BAR } from "./harness";

const harness = createPtyHarness();
setDefaultTimeout(40_000);

afterEach(() => {
  harness.cleanup();
});

/** Sixty numbered lines, with the given lines replaced. */
function numberedTestLines(tag: string, changes: Record<number, string> = {}) {
  return `${Array.from({ length: 60 }, (_, index) => changes[index] ?? `const ${tag}${index} = ${index};`).join("\n")}\n`;
}

describe("PTY z at the end of the review", () => {
  test("shows the last file whole and keeps the view at its last line", async () => {
    const { dir } = harness.createGitRepoFixture([
      {
        path: "a.ts",
        before: numberedTestLines("a"),
        after: numberedTestLines("a", { 30: "const A_CHANGED = 1;" }),
      },
      {
        path: "b.ts",
        before: numberedTestLines("b"),
        after: numberedTestLines("b", { 10: "const B_ONE = 1;", 40: "const B_TWO = 1;" }),
      },
    ]);
    const session = await harness.launchHunk({ args: ["diff"], cwd: dir, cols: 120, rows: 24 });

    try {
      await session.waitForText(REVIEW_MENU_BAR, { timeout: 15_000 });
      await harness.ensureKeyboardIsLive(session);
      await session.type("G");
      const end = await session.waitForText(/B_TWO/, { timeout: 5_000 });
      // The diff stops three lines after the last change; the rest of the file is a hidden gap.
      expect(end).not.toContain("const b59 = 59;");

      await session.type("z");
      const shown = await harness.waitForSnapshot(
        session,
        (text) => text.includes("const b59 = 59;"),
        5_000,
      );
      expect(shown).toContain("Hide 16 unchanged lines");
      // The last row of the file is the last row of the view.
      const rows = shown.trimEnd().split("\n");
      expect(rows.at(-1)).toContain("const b59 = 59;");
    } finally {
      session.close();
    }
  });
});
