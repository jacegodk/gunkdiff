import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPtyHarness, REVIEW_MENU_BAR } from "./harness";

const harness = createPtyHarness();
setDefaultTimeout(40_000);

afterEach(() => {
  harness.cleanup();
});

describe("PTY viewed marks on new files", () => {
  test("V folds a file that has no previous version", async () => {
    const { dir } = harness.createGitRepoFixture([
      {
        path: "alpha.ts",
        before: "export const alpha = 1;\n",
        after: "export const alpha = 2;\n",
      },
    ]);
    // Untracked, so the review shows it as a new file.
    writeFileSync(
      join(dir, "fresh.ts"),
      "export const FRESH_ONE = 1;\nexport const FRESH_TWO = 2;\n",
    );
    const session = await harness.launchHunk({ args: ["diff"], cwd: dir, cols: 140, rows: 30 });

    try {
      await session.waitForText(REVIEW_MENU_BAR, { timeout: 15_000 });
      await session.waitForText(/FRESH_ONE/, { timeout: 15_000 });

      // `.` moves the selection to the next file, the new one.
      await session.press(".");
      await Bun.sleep(300);
      await session.type("V");
      const screen = await harness.waitForSnapshot(
        session,
        (text) => !text.includes("FRESH_ONE") && text.includes("viewed"),
        10_000,
      );
      expect(screen).not.toContain("FRESH_ONE");
      expect(screen).toMatch(/✓ viewed/);
    } finally {
      session.close();
    }
  });

  test("V folds a committed new file in a review against an earlier commit", async () => {
    const { dir } = harness.createGitRepoFixture([
      {
        path: "alpha.ts",
        before: "export const alpha = 1;\n",
        after: "export const alpha = 2;\n",
      },
    ]);
    writeFileSync(
      join(dir, "fresh.ts"),
      "export const FRESH_ONE = 1;\nexport const FRESH_TWO = 2;\n",
    );
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
    git("add", ".");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "add fresh");
    const session = await harness.launchHunk({
      args: ["diff", "HEAD~1"],
      cwd: dir,
      cols: 140,
      rows: 30,
    });

    try {
      await session.waitForText(REVIEW_MENU_BAR, { timeout: 15_000 });
      await session.waitForText(/FRESH_ONE/, { timeout: 15_000 });
      await session.press(".");
      await Bun.sleep(300);
      await session.type("V");
      const screen = await harness.waitForSnapshot(
        session,
        (text) => !text.includes("FRESH_ONE") && text.includes("viewed"),
        10_000,
      );
      expect(screen).not.toContain("FRESH_ONE");
      expect(screen).toMatch(/✓ viewed/);
    } finally {
      session.close();
    }
  });

  test("a file marked viewed comes back folded on reopen without being selected", async () => {
    const { dir } = harness.createGitRepoFixture([
      {
        path: "alpha.ts",
        before: "export const alpha = 1;\n",
        after: "export const ALPHA_CHANGE = 2;\n",
      },
      {
        path: "beta.ts",
        before: "export const beta = 1;\n",
        after: "export const BETA_CHANGE = 2;\n",
      },
    ]);
    writeFileSync(join(dir, "fresh.ts"), "export const FRESH_ONE = 1;\n");
    const open = () => harness.launchHunk({ args: ["diff"], cwd: dir, cols: 140, rows: 30 });

    let session = await open();
    try {
      await session.waitForText(REVIEW_MENU_BAR, { timeout: 15_000 });
      await session.waitForText(/FRESH_ONE/, { timeout: 15_000 });
      // Mark beta (changed) and fresh (new), leaving the selection on them.
      await session.press(".");
      await Bun.sleep(300);
      await session.type("V");
      await harness.waitForSnapshot(session, (text) => !text.includes("BETA_CHANGE"), 10_000);
      await session.press(".");
      await Bun.sleep(300);
      await session.type("V");
      await harness.waitForSnapshot(session, (text) => !text.includes("FRESH_ONE"), 10_000);
    } finally {
      session.close();
    }

    // Reopen: the selection starts on alpha, and both marked files must come back folded.
    session = await open();
    try {
      await session.waitForText(REVIEW_MENU_BAR, { timeout: 15_000 });
      await session.waitForText(/ALPHA_CHANGE/, { timeout: 15_000 });
      const screen = await harness.waitForSnapshot(
        session,
        (text) => !text.includes("BETA_CHANGE") && !text.includes("FRESH_ONE"),
        10_000,
      );
      expect(screen).not.toContain("BETA_CHANGE");
      expect(screen).not.toContain("FRESH_ONE");
      expect(screen.match(/✓ viewed/g)?.length).toBe(2);
    } finally {
      session.close();
    }
  });
});
