import { beforeEach, describe, expect, test } from "bun:test";
import type { ExtensionChangeset, ExtensionDiffFile } from "../../../../extension-api";
import {
  applySingleFileTransform,
  clearSingleFileReturn,
  enterSingleFile,
  exitSingleFile,
  findFilePaths,
  getSingleFileState,
  neighborPath,
  resetSingleFileForTests,
  retargetFromPane,
  setSingleFilePending,
  setSingleFilePaneRetarget,
  setSingleFileTarget,
  subscribeSingleFile,
} from "./singleFile";

function file(id: string, path: string): ExtensionDiffFile {
  return { id, path, patch: "", stats: { additions: 0, deletions: 0 }, metadata: {}, agent: null };
}
const files = [file("1", "a.ts"), file("2", "b.ts"), file("3", "c.ts")];
const changeset: ExtensionChangeset = { id: "cs", sourceLabel: "t", title: "t", files };

beforeEach(() => resetSingleFileForTests());

describe("single-file state", () => {
  test("starts inactive", () => {
    expect(getSingleFileState()).toEqual({
      active: false,
      targetPath: null,
      pendingPath: null,
      returnPath: null,
    });
  });
  test("enter, retarget, pending, exit publish new snapshots", () => {
    let notified = 0;
    subscribeSingleFile(() => notified++);
    enterSingleFile("a.ts");
    expect(getSingleFileState()).toEqual({
      active: true,
      targetPath: "a.ts",
      pendingPath: null,
      returnPath: null,
    });
    setSingleFileTarget("b.ts");
    setSingleFilePending("c.ts");
    expect(getSingleFileState()).toEqual({
      active: true,
      targetPath: "b.ts",
      pendingPath: "c.ts",
      returnPath: null,
    });
    exitSingleFile("b.ts");
    expect(getSingleFileState()).toEqual({
      active: false,
      targetPath: null,
      pendingPath: null,
      returnPath: "b.ts",
    });
    expect(notified).toBe(4);
  });

  test("clearSingleFileReturn nulls returnPath, and is a no-op when already null", () => {
    let notified = 0;
    exitSingleFile("a.ts");
    subscribeSingleFile(() => notified++);
    clearSingleFileReturn();
    expect(getSingleFileState().returnPath).toBeNull();
    expect(notified).toBe(1);
    clearSingleFileReturn();
    expect(notified).toBe(1);
  });

  test("setSingleFileTarget and setSingleFilePending are no-ops when nothing changes", () => {
    enterSingleFile("a.ts");
    let notified = 0;
    subscribeSingleFile(() => notified++);
    setSingleFileTarget("a.ts");
    setSingleFilePending(null);
    expect(notified).toBe(0);
    setSingleFileTarget("b.ts");
    expect(notified).toBe(1);
    setSingleFilePending("c.ts");
    expect(notified).toBe(2);
  });
});

describe("applySingleFileTransform", () => {
  test("returns the changeset unchanged when inactive", () => {
    expect(applySingleFileTransform(changeset, getSingleFileState())).toBe(changeset);
  });
  test("keeps only the target file when active", () => {
    const out = applySingleFileTransform(changeset, {
      active: true,
      targetPath: "b.ts",
      pendingPath: null,
      returnPath: null,
    });
    expect(out.files.map((f) => f.id)).toEqual(["2"]);
    expect(out.id).toBe("cs");
  });
  test("returns the changeset unchanged when the target is missing", () => {
    expect(
      applySingleFileTransform(changeset, {
        active: true,
        targetPath: "zzz",
        pendingPath: null,
        returnPath: null,
      }),
    ).toBe(changeset);
  });
});

describe("neighborPath", () => {
  test("moves without wrapping", () => {
    expect(neighborPath(files, "a.ts", 1)).toBe("b.ts");
    expect(neighborPath(files, "c.ts", 1)).toBeNull();
    expect(neighborPath(files, "a.ts", -1)).toBeNull();
    expect(neighborPath(files, "b.ts", -1)).toBe("a.ts");
  });
  test("null or unknown target starts at an end", () => {
    expect(neighborPath(files, null, 1)).toBe("a.ts");
    expect(neighborPath(files, "missing", -1)).toBe("c.ts");
    expect(neighborPath([], null, 1)).toBeNull();
  });
});

describe("findFilePaths", () => {
  const files = [
    { path: "src/app.ts" },
    { path: "docs/help.md" },
    { path: "src/ui/HelpDialog.tsx" },
  ];

  test("ranks a file-name match first, then by path length, and drops non-matches", () => {
    expect(findFilePaths(files, "help")).toEqual(["docs/help.md", "src/ui/HelpDialog.tsx"]);
    expect(findFilePaths(files, "HlpDlg")).toEqual(["src/ui/HelpDialog.tsx"]);
    expect(findFilePaths(files, "zzz")).toEqual([]);
  });
});

describe("retargetFromPane", () => {
  test("hands the clicked path to the installed retarget, and reports when none is installed", () => {
    resetSingleFileForTests();
    expect(retargetFromPane("a.ts")).toBe(false);
    const seen: string[] = [];
    setSingleFilePaneRetarget((path) => seen.push(path));
    expect(retargetFromPane("b.ts")).toBe(true);
    expect(seen).toEqual(["b.ts"]);
  });
});
