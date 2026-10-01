import { describe, expect, test } from "bun:test";
import { findFiles } from "./fileFinder";

const files = [
  { id: "1", path: "src/ui/App.tsx" },
  { id: "2", path: "src/ui/components/chrome/HelpDialog.tsx" },
  { id: "3", path: "docs/help.md" },
  { id: "4", path: "src/app/startup.ts" },
];

describe("findFiles", () => {
  test("a blank query keeps every file in review order", () => {
    expect(findFiles(files, "  ").map((file) => file.id)).toEqual(["1", "2", "3", "4"]);
  });

  test("ranks a match in the file name above one in the path, then by path length", () => {
    expect(findFiles(files, "help").map((file) => file.id)).toEqual(["3", "2"]);
    expect(findFiles(files, "app").map((file) => file.id)).toEqual(["1", "4"]);
  });

  test("matches scattered letters in order, ignoring case", () => {
    expect(findFiles(files, "HlpDlg").map((file) => file.id)).toEqual(["2"]);
    expect(findFiles(files, "zzz")).toEqual([]);
  });
});
