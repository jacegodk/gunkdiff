import { useCallback, useRef, useState } from "react";
import { commitFile, suggestCommitMessage } from "../lib/commitEdit";

export interface CommitEditState {
  repoRoot: string;
  path: string;
  message: string;
  /** "suggesting" while Claude writes the message, "committing" while git runs. */
  busy: "suggesting" | "committing" | null;
}

/**
 * gunk: drive the "commit your edit?" prompt that follows an `e` save in a review that ends at a
 * commit. Opening asks Claude for a message; the user edits it, Enter commits only that file and
 * reloads, Esc leaves the edit uncommitted. A late message for a prompt the user already closed is
 * dropped; Esc waits while git commits.
 */
export function useCommitEditController({
  onCommitted,
  showNotice,
}: {
  onCommitted: () => void;
  showNotice: (message: string) => void;
}) {
  const [state, setState] = useState<CommitEditState | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Bumped on every open and close, so async results from an older prompt can tell they are stale.
  const tokenRef = useRef(0);

  const openCommitEdit = useCallback((repoRoot: string, path: string) => {
    const token = ++tokenRef.current;
    setState({ repoRoot, path, message: "", busy: "suggesting" });
    void suggestCommitMessage(repoRoot, path).then((message) => {
      if (tokenRef.current !== token) return;
      setState((current) => (current ? { ...current, message, busy: null } : current));
    });
  }, []);

  const closeCommitEdit = useCallback(() => {
    // A running commit cannot be taken back, so the prompt stays until it reports.
    if (stateRef.current?.busy === "committing") return;
    tokenRef.current++;
    setState(null);
  }, []);

  const setCommitEditMessage = useCallback((update: (message: string) => string) => {
    setState((current) =>
      current && current.busy === null ? { ...current, message: update(current.message) } : current,
    );
  }, []);

  const acceptCommitEdit = useCallback(() => {
    const current = stateRef.current;
    if (!current || current.busy !== null || current.message.trim() === "") return;
    const token = tokenRef.current;
    setState({ ...current, busy: "committing" });
    void commitFile(current.repoRoot, current.path, current.message.trim()).then((error) => {
      if (tokenRef.current !== token) return;
      tokenRef.current++;
      setState(null);
      if (error) {
        showNotice(error);
        return;
      }
      showNotice(`Committed ${current.path}.`);
      onCommitted();
    });
  }, [onCommitted, showNotice]);

  return {
    commitEdit: state,
    acceptCommitEdit,
    closeCommitEdit,
    openCommitEdit,
    setCommitEditMessage,
  };
}
