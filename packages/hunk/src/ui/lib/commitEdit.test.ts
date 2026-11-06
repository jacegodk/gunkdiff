import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CliInput } from "../../core/run/commandInputs";
import {
  cleanSuggestedMessage,
  commitFile,
  fileHasUncommittedEdit,
  reviewEndsAtCommit,
} from "./commitEdit";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function createTestRepo() {
  const dir = mkdtempSync(join(tmpdir(), "gunk-commit-edit-"));
  dirs.push(dir);
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
      cwd: dir,
      encoding: "utf8",
    });
  git("init", "-q");
  git("config", "user.name", "t");
  git("config", "user.email", "t@t");
  writeFileSync(join(dir, "a.txt"), "one\n");
  writeFileSync(join(dir, "b.txt"), "one\n");
  git("add", ".");
  git("commit", "-qm", "init");
  return { dir, git };
}

function vcsTestInput(fields: Record<string, unknown>) {
  return { kind: "vcs", staged: false, options: {}, ...fields } as unknown as CliInput;
}

describe("reviewEndsAtCommit", () => {
  test("is true for two revisions, a range, --staged and show; false for a working-tree diff", () => {
    expect(reviewEndsAtCommit(vcsTestInput({ rangeEndpoints: { from: "a", to: "HEAD" } }))).toBe(
      true,
    );
    expect(reviewEndsAtCommit(vcsTestInput({ range: "main..HEAD" }))).toBe(true);
    expect(reviewEndsAtCommit(vcsTestInput({ staged: true }))).toBe(true);
    expect(reviewEndsAtCommit({ kind: "show", options: {} } as unknown as CliInput)).toBe(true);
    expect(reviewEndsAtCommit(vcsTestInput({ range: "origin/develop" }))).toBe(false);
    expect(reviewEndsAtCommit(vcsTestInput({}))).toBe(false);
  });
});

describe("cleanSuggestedMessage", () => {
  test("keeps the first non-empty line without quotes", () => {
    expect(cleanSuggestedMessage('\n"fix: tidy the changelog"\nmore')).toBe(
      "fix: tidy the changelog",
    );
    expect(cleanSuggestedMessage("  \n")).toBe("");
  });
});

describe("commit helpers", () => {
  test("see an edit, then commit only that file", async () => {
    const { dir, git } = createTestRepo();
    expect(await fileHasUncommittedEdit(dir, "a.txt")).toBe(false);

    writeFileSync(join(dir, "a.txt"), "two\n");
    writeFileSync(join(dir, "b.txt"), "two\n");
    expect(await fileHasUncommittedEdit(dir, "a.txt")).toBe(true);

    expect(await commitFile(dir, "a.txt", "edit a")).toBeNull();
    expect(git("log", "-1", "--format=%s").trim()).toBe("edit a");
    expect(git("status", "--short").trim()).toBe("M b.txt");
  });

  test("report a failed commit and treat a non-repo as unedited", async () => {
    const { dir } = createTestRepo();
    expect(await commitFile(dir, "a.txt", "nothing changed")).toMatch(/^Commit failed: /);
    const plain = mkdtempSync(join(tmpdir(), "gunk-commit-edit-plain-"));
    dirs.push(plain);
    writeFileSync(join(plain, "a.txt"), "x\n");
    expect(await fileHasUncommittedEdit(plain, "a.txt")).toBe(false);
  });
});
