import { execSync } from "node:child_process";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import { removeTestDirectory } from "../../../../test/helpers/filesystem";

const { getBundledVcsCatalog } = await import("../app/vcsCatalog");
const { loadAppBootstrap } = await import("../core/changeset/loaders");
const { TestAppHost: AppHost } = await import("../../../../test/helpers/app-host");

async function flush(setup: Awaited<ReturnType<typeof testRender>>) {
  await act(async () => {
    await setup.renderOnce();
    await Bun.sleep(0);
    await setup.renderOnce();
  });
}

/** Poll frames until `predicate` holds, or return the last frame after the attempts run out. */
async function waitForFrame(
  setup: Awaited<ReturnType<typeof testRender>>,
  predicate: (frame: string) => boolean,
  attempts = 40,
) {
  let frame = "";
  for (let attempt = 0; attempt < attempts; attempt++) {
    await flush(setup);
    frame = setup.captureCharFrame();
    if (predicate(frame)) return frame;
    await Bun.sleep(50);
  }
  return frame;
}

/** A repository on `main` with ten changed files; the last one sits far below the first screen. */
function createTestManyFileRepo() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "hunk-file-finder-")));
  const git = (cmd: string) => execSync(cmd, { cwd: dir, stdio: "ignore" });
  git("git init -q -b main && git config user.email test@test && git config user.name test");
  const names = [...Array.from({ length: 9 }, (_, index) => `file-${index}.txt`), "zz-target.txt"];
  for (const name of names) writeFileSync(join(dir, name), "one\ntwo\nthree\n");
  git("git add . && git commit -q -m init");
  for (const name of names) writeFileSync(join(dir, name), `one\ntwo\nthree\nchanged ${name}\n`);
  return dir;
}

describe("file finder", () => {
  test("t finds a file by name and Enter jumps the review to it; ctrl+t opens themes", async () => {
    const dir = createTestManyFileRepo();
    const bootstrap = await loadAppBootstrap(
      { kind: "vcs", staged: false, options: { mode: "unified", excludeUntracked: true } },
      { cwd: dir, vcsCatalog: getBundledVcsCatalog() },
    );
    const setup = await testRender(<AppHost bootstrap={bootstrap} />, {
      width: 120,
      height: 20,
      kittyKeyboard: true,
    });

    try {
      let frame = await waitForFrame(setup, (f) => f.includes("changed file-0.txt"));
      expect(frame).not.toContain("changed zz-target.txt");

      await act(async () => {
        await setup.mockInput.typeText("t");
      });
      frame = await waitForFrame(setup, (f) => f.includes("Find a file"));
      expect(frame).toContain("file-0.txt");

      // Letters type into the query rather than reaching the review (j, k, t are all bound).
      await act(async () => {
        await setup.mockInput.typeText("ztgt");
      });
      frame = await waitForFrame(setup, (f) => f.includes("> ztgt"));
      expect(frame).not.toContain("file-0.txt");
      expect(frame).toMatch(/›\s+zz-target\.txt/);

      await act(async () => {
        await setup.mockInput.pressEnter();
      });
      frame = await waitForFrame(setup, (f) => f.includes("changed zz-target.txt"));
      expect(frame).toContain("changed zz-target.txt");
      expect(frame).not.toContain("Find a file");

      await act(async () => {
        setup.mockInput.pressKey("t", { ctrl: true });
      });
      frame = await waitForFrame(setup, (f) => f.includes("Find a file") || f.includes("Theme"));
      expect(frame).not.toContain("Find a file");
      expect(frame).toContain("Theme");
    } finally {
      await act(async () => {
        setup.renderer.destroy();
      });
      await removeTestDirectory(dir);
    }
  });
});
