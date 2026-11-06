import type { AppCommand } from "./appCommands";

/**
 * The curated content of the controls help dialog.
 *
 * The rows are hand-written — grouped, ordered, and worded for someone learning
 * the app — but the keys in them are not: each row names the commands it
 * documents and the key column is rendered from whatever chords those commands
 * currently answer to. Remap a command and help says so; unbind it and its row
 * disappears rather than advertising a key that does nothing.
 *
 * A few rows document behavior that is not a command at all (the mouse wheel,
 * F10 opening the menus, which belong to the widgets that own them). Those
 * carry literal key text, and are the only place a key is written by hand.
 */

/** One documented row, as declared. */
type HelpEntrySpec = {
  description: string;
} & ({ keys: string } | { commandIds: readonly string[] });

interface HelpSectionSpec {
  title: string;
  entries: readonly HelpEntrySpec[];
}

/** One rendered row: the key column text and what it does. */
export interface HelpRow {
  keys: string;
  description: string;
}

/** One rendered section of the dialog. */
export interface HelpSection {
  title: string;
  rows: HelpRow[];
}

// gunk: one action per row, so every key can be found by reading down the key column; only true
// pairs (up / down, previous / next) share a row. Groups follow the task, not the code: where you
// move, what you find, what you do to files, hidden lines, notes, selection, display, the app.
// The bundled hunk-viewed keys (`hunk-viewed.*`) are curated here too, as part of gunk.
const HELP_SECTIONS: readonly HelpSectionSpec[] = [
  {
    title: "Move",
    entries: [
      {
        commandIds: ["hunk.review.stepUp", "hunk.review.stepDown"],
        description: "one line or note",
      },
      {
        commandIds: ["hunk.review.stepUpInHunk", "hunk.review.stepDownInHunk"],
        description: "through the hunk's changed lines",
      },
      {
        commandIds: ["hunk.review.previousHunk", "hunk.review.nextHunk"],
        description: "previous / next hunk",
      },
      {
        commandIds: ["hunk.review.previousFile", "hunk.review.nextFile"],
        description: "previous / next file",
      },
      {
        commandIds: ["hunk.review.previousAnnotatedHunk", "hunk.review.nextAnnotatedHunk"],
        description: "previous / next note",
      },
      { commandIds: ["hunk.review.pageUp"], description: "page up" },
      { commandIds: ["hunk.review.pageDown"], description: "page down" },
      {
        commandIds: ["hunk.review.halfPageUp", "hunk.review.halfPageDown"],
        description: "half page up / down",
      },
      { commandIds: ["hunk.review.jumpToTop"], description: "jump to start" },
      { commandIds: ["hunk.review.jumpToBottom"], description: "jump to end" },
      {
        commandIds: ["hunk.review.scrollCodeLeft", "hunk.review.scrollCodeRight"],
        description: "scroll code sideways (Shift = faster)",
      },
    ],
  },
  {
    title: "Find",
    entries: [
      { commandIds: ["hunk.review.findFile"], description: "find a file by name" },
      {
        commandIds: ["hunk-viewed.search"],
        description: "search; tab in the prompt switches all source / diff only",
      },
      { commandIds: ["hunk-viewed.searchNext"], description: "next match" },
      { commandIds: ["hunk-viewed.searchPrevious"], description: "previous match" },
      {
        commandIds: ["hunk.search.next", "hunk.search.previous"],
        description: "next / previous match (notes when no search)",
      },
      { commandIds: ["hunk.review.focusFilter"], description: "focus file filter" },
      { commandIds: ["hunk.app.toggleFocusArea"], description: "toggle files/filter focus" },
    ],
  },
  {
    title: "Files",
    entries: [
      { commandIds: ["hunk-viewed.toggleViewed"], description: "mark viewed and fold, or unmark" },
      { commandIds: ["hunk-viewed.skipToUnviewed"], description: "next unviewed file" },
      {
        commandIds: ["hunk-viewed.nextUnviewed", "hunk-viewed.previousUnviewed"],
        description: "next / previous file",
      },
      {
        commandIds: ["hunk-viewed.singleFile"],
        description: "one file at a time (, . t switch, Esc leaves)",
      },
      { commandIds: ["hunk.review.expandFile"], description: "show this file whole" },
      { commandIds: ["hunk.review.expandAllFiles"], description: "show every file whole" },
      { commandIds: ["hunk.review.editSelectedFile"], description: "open file in $EDITOR" },
      { commandIds: ["hunk.view.toggleFilesPane"], description: "show or hide the files pane" },
      { commandIds: ["hunk-viewed.clearRepo"], description: "clear viewed marks for this repo" },
    ],
  },
  {
    title: "Hidden lines",
    entries: [
      {
        commandIds: ["hunk.review.toggleHunkGap"],
        description: "show or hide unchanged lines by the hunk",
      },
      {
        commandIds: ["hunk.review.expandAroundHunk"],
        description: "10 more lines around the hunk",
      },
      {
        commandIds: ["hunk.review.shrinkAroundHunk"],
        description: "10 fewer lines around the hunk",
      },
    ],
  },
  {
    title: "Notes",
    entries: [
      { commandIds: ["hunk.review.startNote"], description: "create review note" },
      { commandIds: ["hunk.review.editActiveNote"], description: "edit the active note" },
      { commandIds: ["hunk.review.replyToActiveNote"], description: "reply to the active note" },
      { commandIds: ["hunk.review.deleteActiveNote"], description: "delete the active note" },
      {
        commandIds: ["hunk.review.toggleActiveNoteHandled"],
        description: "flag the active note handled",
      },
      { commandIds: ["hunk.view.toggleAgentNotes"], description: "show or hide agent notes" },
      { commandIds: ["hunk.view.toggleUserNotes"], description: "show or hide my notes" },
      { commandIds: ["hunk.view.toggleHandledNotes"], description: "show or hide handled notes" },
    ],
  },
  {
    title: "Select and copy",
    entries: [
      { commandIds: ["hunk.review.startVisualSelection"], description: "select text" },
      { commandIds: ["hunk.review.copySelection"], description: "copy the selection" },
    ],
  },
  {
    title: "Layout and display",
    entries: [
      { commandIds: ["hunk.view.layoutUnified"], description: "unified view" },
      { commandIds: ["hunk.view.layoutSplit"], description: "split view" },
      { commandIds: ["hunk.view.layoutAuto"], description: "auto: split when wide" },
      { commandIds: ["hunk.view.toggleLineNumbers"], description: "line numbers" },
      { commandIds: ["hunk.view.toggleLineWrap"], description: "line wrap" },
      { commandIds: ["hunk.view.toggleHunkHeaders"], description: "hunk headers" },
      { commandIds: ["hunk.view.toggleMenuBar"], description: "menu bar" },
      { commandIds: ["hunk.view.openThemeSelector"], description: "choose theme" },
    ],
  },
  {
    title: "App",
    entries: [
      { commandIds: ["hunk.app.refresh"], description: "reload the review" },
      { commandIds: ["hunk.app.openReviewPicker"], description: "pick worktree / base" },
      { commandIds: ["hunk.app.openCommitPicker"], description: "pick a commit of this review" },
      { keys: "F10", description: "open menus" },
      { commandIds: ["hunk.app.toggleHelp"], description: "show this help" },
      { commandIds: ["hunk.app.quit"], description: "quit" },
    ],
  },
  {
    title: "Mouse",
    entries: [
      { keys: "Wheel", description: "scroll vertically" },
      { keys: "Shift+Wheel", description: "scroll code horizontally" },
      { keys: "Click header", description: "select that file" },
      { keys: "Click ▼ / ▲", description: "show hidden lines from that end" },
    ],
  },
];

/**
 * Every command id the help dialog documents.
 *
 * Exported so the command-parity check can assert help names only catalogued commands: a
 * row pointing at an id nobody registered would silently vanish instead of failing.
 */
export const HELP_COMMAND_IDS: readonly string[] = HELP_SECTIONS.flatMap((section) =>
  section.entries.flatMap((entry) => ("commandIds" in entry ? [...entry.commandIds] : [])),
);

/**
 * Render one entry's key column, or nothing when it documents no live key.
 *
 * A row about one command lists every chord it answers to, since there is room
 * for the alternates; a row covering several commands shows each one's primary
 * chord instead, so the column stays readable. Either way a command that is
 * disabled or unbound contributes nothing, and a row left with no keys at all
 * is dropped by the caller.
 */
function helpEntryKeys(commands: readonly AppCommand[], spec: HelpEntrySpec): string | undefined {
  if ("keys" in spec) {
    return spec.keys;
  }

  const labels = spec.commandIds.flatMap((id) => {
    const command = commands.find((candidate) => candidate.id === id);
    // gunk: a key reference lists what the keyboard does, not what is available this second.
    // Note actions, copy and the like are bound whether or not the moment enables them.
    if (!command || command.keyLabels.length === 0) {
      return [];
    }

    return spec.commandIds.length === 1 ? [...command.keyLabels] : command.keyLabels.slice(0, 1);
  });

  return labels.length > 0 ? labels.join(" / ") : undefined;
}

/** gunk: headings for the extensions compiled into gunk, which read as part of the app. */
const BUILT_IN_EXTENSION_HELP_TITLES: Readonly<Record<string, string>> = {
  "hunk-viewed": "Viewed files and search",
};

/**
 * gunk: one section per loaded extension, listing every bound command it registered, so the
 * built-in hunk-viewed keys (and any installed extension's) show up in `?` beside hunk's own.
 * Built-in and bundled commands live under the `hunk.` owner and are curated above instead.
 */
function extensionHelpSections(commands: readonly AppCommand[]): HelpSection[] {
  const byExtension = new Map<string, HelpRow[]>();
  for (const command of commands) {
    const owner = command.id.slice(0, command.id.indexOf("."));
    if (owner === "" || owner === "hunk" || command.keyLabels.length === 0) continue;
    // gunk: a command curated above already has its row.
    if (HELP_COMMAND_IDS.includes(command.id)) continue;
    const rows = byExtension.get(owner) ?? [];
    rows.push({ keys: command.keyLabels.join(" / "), description: command.title });
    byExtension.set(owner, rows);
  }
  return [...byExtension.entries()].map(([owner, rows]) => ({
    title: BUILT_IN_EXTENSION_HELP_TITLES[owner] ?? `Extension ${owner}`,
    rows,
  }));
}

/** Build the help dialog's sections against the session's live command table. */
export function buildHelpSections(commands: readonly AppCommand[]): HelpSection[] {
  const curated = HELP_SECTIONS.map((section) => ({
    title: section.title,
    rows: section.entries.flatMap((spec) => {
      const keys = helpEntryKeys(commands, spec);
      return keys === undefined ? [] : [{ keys, description: spec.description }];
    }),
  })).filter((section) => section.rows.length > 0);
  return [...curated, ...extensionHelpSections(commands)];
}
