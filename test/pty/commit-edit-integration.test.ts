import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPtyHarness, REVIEW_MENU_BAR } from "./harness";

const harness = createPtyHarness();
setDefaultTimeout(40_000);

const binDirs: string[] = [];
afterEach(() => {
  harness.cleanup();
  for (const dir of binDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A bin folder with an editor that appends a line and a `claude` that answers with a fixed message. */
function createTestBin() {
  const bin = mkdtempSync(join(tmpdir(), "gunk-commit-edit-bin-"));
  binDirs.push(bin);
  writeFileSync(join(bin, "edit"), '#!/bin/sh\necho "export const EDITED_LINE = 3;" >> "$1"\n');
  writeFileSync(join(bin, "claude"), "#!/bin/sh\ncat > /dev/null\necho 'fix: fake message'\n");
  chmodSync(join(bin, "edit"), 0o755);
  chmodSync(join(bin, "claude"), 0o755);
  return bin;
}

describe("PTY commit after an edit", () => {
  test("e in a review that ends at HEAD offers a commit, and Enter commits and shows the edit", async () => {
    const { dir } = harness.createGitRepoFixture([
      { path: "alpha.ts", before: "export const alpha = 1;\n", after: "export const ALPHA = 2;\n" },
    ]);
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
    git("commit", "-qam", "change alpha");
    const bin = createTestBin();
    const session = await harness.launchHunk({
      args: ["diff", "HEAD~1", "HEAD"],
      cwd: dir,
      cols: 140,
      rows: 30,
      env: { EDITOR: join(bin, "edit"), PATH: `${bin}:${process.env.PATH}` },
    });

    try {
      await session.waitForText(REVIEW_MENU_BAR, { timeout: 15_000 });
      await session.waitForText(/ALPHA = 2/, { timeout: 15_000 });
      await session.press("e");
      await session.waitForText(/Commit your edit\?/, { timeout: 10_000 });
      await session.waitForText(/> fix: fake message/, { timeout: 10_000 });

      await session.type("!");
      await session.press("enter");
      await session.waitForText(/EDITED_LINE/, { timeout: 10_000 });

      expect(git("log", "-1", "--format=%s").trim()).toBe("fix: fake message!");
      expect(git("status", "--short").trim()).toBe("");
    } finally {
      session.close();
    }
  });

  test("Esc keeps the edit uncommitted", async () => {
    const { dir } = harness.createGitRepoFixture([
      { path: "alpha.ts", before: "export const alpha = 1;\n", after: "export const ALPHA = 2;\n" },
    ]);
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
    git("commit", "-qam", "change alpha");
    const bin = createTestBin();
    const session = await harness.launchHunk({
      args: ["diff", "HEAD~1", "HEAD"],
      cwd: dir,
      cols: 140,
      rows: 30,
      env: { EDITOR: join(bin, "edit"), PATH: `${bin}:${process.env.PATH}` },
    });

    try {
      await session.waitForText(REVIEW_MENU_BAR, { timeout: 15_000 });
      await session.waitForText(/ALPHA = 2/, { timeout: 15_000 });
      await session.press("e");
      await session.waitForText(/> fix: fake message/, { timeout: 10_000 });
      await session.press("escape");
      await harness.waitForSnapshot(session, (text) => !text.includes("Commit your edit"), 5_000);

      expect(git("log", "-1", "--format=%s").trim()).toBe("change alpha");
      expect(git("status", "--short").trim()).toBe("M alpha.ts");
    } finally {
      session.close();
    }
  });
});
