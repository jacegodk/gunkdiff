import { useSyncExternalStore } from "react";
import type { ExtensionChangeset, ExtensionDiffFile } from "../../../../extension-api";

/** Single-file mode: which file the review shows while the mode is active. */
export interface SingleFileState {
  active: boolean;
  /** Path of the one file the changeset transform keeps. */
  targetPath: string | null;
  /** Path a pane click chose; `enter` inside the mode loads it. */
  pendingPath: string | null;
  /** Path to reselect at the top of the view once the mode's exit reload lands. */
  returnPath: string | null;
}

const initial: SingleFileState = {
  active: false,
  targetPath: null,
  pendingPath: null,
  returnPath: null,
};
let state: SingleFileState = initial;
const listeners = new Set<() => void>();

function publish(next: SingleFileState) {
  state = next;
  for (const listener of listeners) listener();
}

/** Return the current immutable snapshot. */
export function getSingleFileState(): SingleFileState {
  return state;
}

/** Subscribe to changes; returns the unsubscribe function. */
export function subscribeSingleFile(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Read the snapshot from a React component. */
export function useSingleFileState(): SingleFileState {
  return useSyncExternalStore(subscribeSingleFile, getSingleFileState);
}

/** Turn the mode on with the given target. */
export function enterSingleFile(targetPath: string | null): void {
  publish({ active: true, targetPath, pendingPath: null, returnPath: state.returnPath });
}

/** Turn the mode off, forget the target, and remember `returnPath` for the exit reload to reselect. */
export function exitSingleFile(returnPath: string | null): void {
  publish({ active: false, targetPath: null, pendingPath: null, returnPath });
}

/** Forget the pending return-to-file path. No-op when it is already null. */
export function clearSingleFileReturn(): void {
  if (state.returnPath === null) return;
  publish({ ...state, returnPath: null });
}

/** Point the mode at another file. No-op when it is already the target and nothing is pending. */
export function setSingleFileTarget(path: string): void {
  if (state.targetPath === path && state.pendingPath === null) return;
  publish({ ...state, targetPath: path, pendingPath: null });
}

/** Remember a pane click until `enter` loads it. No-op when it is already pending. */
export function setSingleFilePending(path: string | null): void {
  if (state.pendingPath === path) return;
  publish({ ...state, pendingPath: path });
}

/** Keep only the target file while the mode is active; otherwise return the changeset as is. */
export function applySingleFileTransform(
  changeset: ExtensionChangeset,
  current: SingleFileState,
): ExtensionChangeset {
  if (!current.active || current.targetPath === null) return changeset;
  const kept = changeset.files.filter((file) => file.path === current.targetPath);
  if (kept.length === 0) return changeset;
  return { ...changeset, files: kept };
}

/** Path of the file before/after `targetPath` in `files`, no wrap; null/unknown target starts at an end. */
export function neighborPath(
  files: readonly ExtensionDiffFile[],
  targetPath: string | null,
  direction: 1 | -1,
): string | null {
  const index = targetPath === null ? -1 : files.findIndex((file) => file.path === targetPath);
  const next = index === -1 ? (direction === 1 ? 0 : files.length - 1) : index + direction;
  return files[next]?.path ?? null;
}

/**
 * gunk: paths matching `query` for the single-file `t` finder, best first. Mirrors the host
 * finder's ranking in `ui/fileFinder.ts` (this extension imports only the extension API): a match
 * in the file name beats one in the path, a contiguous match beats scattered letters, and among
 * equals the shorter path wins.
 */
export function findFilePaths(files: readonly { path: string }[], query: string): string[] {
  const needle = query.trim().toLowerCase();
  const rank = (path: string): number | null => {
    const haystack = path.toLowerCase();
    if (haystack.slice(haystack.lastIndexOf("/") + 1).includes(needle)) return 0;
    if (haystack.includes(needle)) return 1;
    let from = 0;
    for (const char of needle) {
      const found = haystack.indexOf(char, from);
      if (found === -1) return null;
      from = found + 1;
    }
    return 2;
  };
  return files
    .flatMap((file) => {
      const fileRank = rank(file.path);
      return fileRank === null ? [] : [{ path: file.path, rank: fileRank }];
    })
    .sort((a, b) => a.rank - b.rank || a.path.length - b.path.length)
    .map(({ path }) => path);
}

/** gunk: how a pane click switches the single-file view; set by the extension at startup. */
let paneRetarget: ((path: string) => void) | null = null;

/** gunk: install the pane-click retarget; null removes it. */
export function setSingleFilePaneRetarget(retarget: ((path: string) => void) | null): void {
  paneRetarget = retarget;
}

/** gunk: switch the single-file view to `path` from a pane click; false when nothing can. */
export function retargetFromPane(path: string): boolean {
  if (!paneRetarget) return false;
  paneRetarget(path);
  return true;
}

/** Reset module state between tests. */
export function resetSingleFileForTests(): void {
  state = initial;
  listeners.clear();
  paneRetarget = null;
}
