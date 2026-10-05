import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createPtyHarness, REVIEW_MENU_BAR } from "./harness";

const harness = createPtyHarness();
setDefaultTimeout(40_000);

afterEach(() => {
  harness.cleanup();
});

/** Three changed files, each with a line no other file carries. */
function createTestThreeFileRepo() {
  return harness.createGitRepoFixture(
    ["alpha", "beta", "gamma"].map((name) => ({
      path: `${name}.ts`,
      before: `export const ${name} = 1;\n`,
      after: `export const ${name} = 2;\nexport const ${name.toUpperCase()}_CHANGE = true;\n`,
    })),
  );
}

describe("PTY single-file mode", () => {
  test("search, t and Esc keep or leave the single-file view as the reviewer expects", async () => {
    const { dir } = createTestThreeFileRepo();
    const session = await harness.launchHunk({ args: ["diff"], cwd: dir, cols: 140, rows: 30 });

    try {
      await session.waitForText(REVIEW_MENU_BAR, { timeout: 15_000 });
      await session.waitForText(/ALPHA_CHANGE/, { timeout: 15_000 });
      expect(await session.text({ immediate: true })).toContain("3 files");

      await session.press("o");
      let screen = await harness.waitForSnapshot(
        session,
        (text) => text.includes(" 1 file ") && text.includes("ALPHA_CHANGE"),
        10_000,
      );
      expect(screen).not.toContain("BETA_CHANGE");

      // A search scans every file and switches the view to a hit in another one.
      await session.press(["ctrl", "f"]);
      await session.type("GAMMA_CHANGE");
      await session.press("enter");
      screen = await harness.waitForSnapshot(
        session,
        (text) =>
          text.includes(" 1 file ") && /=\s*true/.test(text) && !text.includes("ALPHA_CHANGE"),
        10_000,
      );
      expect(screen).toContain("export const GAMMA_CHANGE");

      // Esc ends the search, not the single-file view.
      await session.press("escape");
      await Bun.sleep(400);
      screen = await session.text({ immediate: true });
      expect(screen).toContain(" 1 file ");
      expect(screen).toContain("export const GAMMA_CHANGE");
      expect(screen).not.toContain("Search:");
      expect(screen).not.toContain("ignored");

      // t finds any file of the review by name and switches to it.
      await session.press("t");
      await session.waitForText(/Find a file/, { timeout: 5_000 });
      await session.type("beta");
      await session.press("enter");
      screen = await harness.waitForSnapshot(
        session,
        (text) => text.includes(" 1 file ") && text.includes("BETA_CHANGE"),
        10_000,
      );
      expect(screen).not.toContain("GAMMA_CHANGE");

      // A click on a file in the files pane switches the view at once.
      // A one-file review hides the files pane; `s` brings it back.
      await harness.pressAndWaitForText(session, "s", /gamma\.ts/);
      await session.click(/alpha\.ts/);
      screen = await harness.waitForSnapshot(
        session,
        (text) => text.includes(" 1 file ") && text.includes("ALPHA_CHANGE"),
        10_000,
      );
      expect(screen).not.toContain("BETA_CHANGE");

      // Esc now leaves single-file mode.
      await session.press("escape");
      await session.waitForText(/3 files/, { timeout: 10_000 });
    } finally {
      session.close();
    }
  });
});
