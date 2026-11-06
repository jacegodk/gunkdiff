import { describe, expect, test } from "bun:test";
import { getBundledUIRegistry } from "../../extensions/default/ui";
import {
  builtinCommandKeyDefaults,
  builtinCommandMatchProbes,
  type AppCommand,
} from "./appCommands";
import { buildExtensionAppCommands, extensionCommandKeyDefaults } from "./extensionCommands";
import { buildHelpSections, type HelpSection } from "./helpContent";
import { resolveCommandKeys } from "./keymap";
import { buildSessionCommands } from "./sessionRegistrations";

/** The help rows for a session with the given `[keybindings]` entries and bundled commands. */
/** The built-in and bundled command table help is rendered against. */
function helpCommands(userBindings?: Record<string, string | false>): AppCommand[] {
  const bundled = buildSessionCommands(undefined, getBundledUIRegistry());
  const { keys } = resolveCommandKeys({
    defaults: [...builtinCommandKeyDefaults(), ...extensionCommandKeyDefaults(bundled)],
    userBindings,
  });
  const builtins = builtinCommandMatchProbes(keys);
  const { commands } = buildExtensionAppCommands({
    registered: bundled,
    builtins,
    resolvedKeys: keys,
    runCommand: () => {},
  });
  return [...builtins, ...commands];
}

function helpSections(userBindings?: Record<string, string | false>): HelpSection[] {
  return buildHelpSections(helpCommands(userBindings));
}

/** The key column of the row documenting one description. */
function keysFor(sections: HelpSection[], description: string) {
  return sections.flatMap((section) => section.rows).find((row) => row.description === description)
    ?.keys;
}

describe("buildHelpSections", () => {
  test("renders paired rows from each command's primary key", () => {
    const sections = helpSections();

    // gunk: groups follow the task; the hunk-viewed keys are missing here only because this
    // command table has no extensions loaded.
    expect(sections.map((section) => section.title)).toEqual([
      "Move",
      "Find",
      "Files",
      "Hidden lines",
      "Notes",
      "Select and copy",
      "Layout and display",
      "App",
      "Mouse",
    ]);
    expect(keysFor(sections, "previous / next hunk")).toBe("[ / ]");
    expect(keysFor(sections, "half page up / down")).toBe("u / d");
    expect(keysFor(sections, "one line or note")).toBe("Up / Down");
    expect(keysFor(sections, "through the hunk's changed lines")).toBe("k / j");
    expect(keysFor(sections, "previous / next note")).toBe("{ / }");
  });

  test("gunk: one action per row, so every single key can be found down the key column", () => {
    const sections = helpSections();

    expect(keysFor(sections, "show or hide handled notes")).toBe("H");
    expect(keysFor(sections, "show or hide my notes")).toBe("T");
    expect(keysFor(sections, "show or hide agent notes")).toBe("a");
    expect(keysFor(sections, "show or hide unchanged lines by the hunk")).toBe("z");
    expect(keysFor(sections, "10 more lines around the hunk")).toBe("x");
    expect(keysFor(sections, "10 fewer lines around the hunk")).toBe("X");
    expect(keysFor(sections, "copy the selection")).toBe("y");
    expect(keysFor(sections, "unified view")).toBe("1");
    expect(keysFor(sections, "menu bar")).toBe("M");
  });

  test("places a curated extension key in its task group, and leaves unbound ones out", () => {
    const sections = buildHelpSections([
      ...helpCommands(),
      {
        id: "hunk-viewed.toggleViewed",
        title: "Toggle viewed on the selected file",
        keys: ["V"],
        keyLabels: ["V"],
        publicToExtensions: false,
        match: () => false,
        run: () => {},
      },
      {
        id: "hunk-viewed.foldViewed",
        title: "Fold viewed files",
        keys: [],
        keyLabels: [],
        publicToExtensions: false,
        match: () => false,
        run: () => {},
      },
    ]);
    // gunk: a curated built-in extension key sits in its task group, not in a section of its own.
    expect(keysFor(sections, "mark viewed and fold, or unmark")).toBe("V");
    expect(sections.map((candidate) => candidate.title)).not.toContain("Viewed files and search");
    expect(sections.map((candidate) => candidate.title)).not.toContain("Extension hunk-viewed");
    expect(sections.map((candidate) => candidate.title)).not.toContain("Extension hunk");
  });

  test("an installed extension's bound commands still get a section of their own", () => {
    const sections = buildHelpSections([
      ...helpCommands(),
      {
        id: "notes.sync",
        title: "Sync notes",
        keys: ["ctrl+y"],
        keyLabels: ["Ctrl+y"],
        publicToExtensions: false,
        match: () => false,
        run: () => {},
      },
    ]);
    expect(sections.find((section) => section.title === "Extension notes")?.rows).toEqual([
      { keys: "Ctrl+y", description: "Sync notes" },
    ]);
  });

  test("documents the bundled search keys beside the built-in navigation rows", () => {
    const sections = helpSections();

    expect(keysFor(sections, "next / previous match (notes when no search)")).toBe("n / N");
    // The filter ships unbound, so its row disappears rather than advertising nothing.
    expect(keysFor(sections, "focus file filter")).toBeUndefined();
  });

  test("handing / back to the filter takes it from search and shows both truthfully", () => {
    const sections = helpSections({ "hunk.review.focusFilter": "/" });

    expect(keysFor(sections, "focus file filter")).toBe("/");
    expect(keysFor(sections, "next / previous match (notes when no search)")).toBe("n / N");
  });

  test("a row about one command lists every chord it answers to", () => {
    const sections = helpSections();

    expect(keysFor(sections, "page down")).toBe("PageDown / Space / f");
    expect(keysFor(sections, "page up")).toBe("PageUp / b / Shift+Space");
    expect(keysFor(sections, "jump to start")).toBe("g / Home");
  });

  test("keeps the rows that are not commands at all", () => {
    const sections = helpSections();

    expect(keysFor(sections, "scroll vertically")).toBe("Wheel");
    expect(keysFor(sections, "open menus")).toBe("F10");
  });

  test("a remapped command changes what help advertises", () => {
    const sections = helpSections({
      "hunk.review.nextHunk": "ctrl+n",
      "hunk.app.quit": "ctrl+x",
    });

    expect(keysFor(sections, "previous / next hunk")).toBe("[ / Ctrl+n");
    expect(keysFor(sections, "quit")).toBe("Ctrl+x");
  });

  test("an unbound command drops out of its row, and an empty row drops out entirely", () => {
    const sections = helpSections({
      "hunk.review.previousHunk": false,
      "hunk.review.startNote": false,
    });

    // The pair survives on the half that still has a key.
    expect(keysFor(sections, "previous / next hunk")).toBe("]");
    // Nothing left to document, so the row is gone rather than blank.
    expect(keysFor(sections, "create review note")).toBeUndefined();
  });

  test("gunk: a command keeps its row while it is bound, enabled here and now or not", () => {
    const enabled = builtinCommandMatchProbes();
    const disabled: AppCommand[] = enabled.map((command) =>
      command.id === "hunk.app.refresh" ? { ...command, isEnabled: () => false } : command,
    );

    // The dialog is a key reference: a note action or a refresh keeps its key on the list even
    // when this moment cannot run it. Only an unbound command drops out.
    expect(keysFor(buildHelpSections(enabled), "reload the review")).toBe("r");
    expect(keysFor(buildHelpSections(disabled), "reload the review")).toBe("r");
  });
});
