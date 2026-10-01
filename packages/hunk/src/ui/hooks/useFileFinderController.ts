import { useCallback, useMemo, useRef, useState } from "react";
import { findFiles, type FileFinderFile } from "../fileFinder";

interface FileFinderState {
  query: string;
  selectedIndex: number;
}

export interface UseFileFinderControllerOptions {
  files: readonly FileFinderFile[];
  onJumpToFile: (fileId: string) => void;
}

/**
 * gunk: drive the `t` file finder. Typing narrows the review's visible files by path, the
 * best match is preselected, and accepting jumps the review stream to that file the way a
 * sidebar click does. The finder owns only its query and highlight; selection stays with the
 * review.
 */
export function useFileFinderController({ files, onJumpToFile }: UseFileFinderControllerOptions) {
  const [state, setState] = useState<FileFinderState | null>(null);
  const matches = useMemo(() => (state ? findFiles(files, state.query) : []), [files, state]);
  const matchesRef = useRef(matches);
  matchesRef.current = matches;
  const stateRef = useRef(state);
  stateRef.current = state;

  const openFileFinder = useCallback(() => setState({ query: "", selectedIndex: 0 }), []);
  const closeFileFinder = useCallback(() => setState(null), []);

  /** Replace the query; the highlight returns to the best match. */
  const setFileFinderQuery = useCallback((update: (query: string) => string) => {
    setState((current) => (current ? { query: update(current.query), selectedIndex: 0 } : current));
  }, []);

  const moveFileFinder = useCallback((delta: number) => {
    setState((current) => {
      const count = matchesRef.current.length;
      if (!current || count === 0) return current;
      return {
        ...current,
        selectedIndex: (((current.selectedIndex + delta) % count) + count) % count,
      };
    });
  }, []);

  const selectFileFinderItem = useCallback((index: number) => {
    setState((current) =>
      current && index !== current.selectedIndex ? { ...current, selectedIndex: index } : current,
    );
  }, []);

  /** Jump to the match at `index` (the highlighted one by default) and close. */
  const acceptFileFinderItem = useCallback(
    (index?: number) => {
      const file = matchesRef.current[index ?? stateRef.current?.selectedIndex ?? 0];
      if (!file) return;
      setState(null);
      onJumpToFile(file.id);
    },
    [onJumpToFile],
  );

  return {
    fileFinderOpen: state !== null,
    fileFinderQuery: state?.query ?? "",
    fileFinderMatches: matches,
    fileFinderSelectedIndex: Math.min(state?.selectedIndex ?? 0, Math.max(0, matches.length - 1)),
    acceptFileFinder: () => acceptFileFinderItem(),
    acceptFileFinderItem,
    closeFileFinder,
    moveFileFinder,
    openFileFinder,
    selectFileFinderItem,
    setFileFinderQuery,
  };
}
