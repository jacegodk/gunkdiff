import type { CommitEditState } from "../../hooks/useCommitEditController";
import { fitText } from "../../lib/text";
import type { AppTheme } from "../../themes";
import { ConfirmDialog, confirmDialogHeight } from "./ConfirmDialog";

/**
 * gunk: the prompt after an `e` save in a review that ends at a commit. It says why the reload
 * cannot show the edit and offers a commit of that file with an editable, suggested message.
 */
export function CommitEditDialog({
  state,
  terminalHeight,
  terminalWidth,
  theme,
  onAccept,
  onClose,
}: {
  state: CommitEditState;
  terminalHeight: number;
  terminalWidth: number;
  theme: AppTheme;
  onAccept: () => void;
  onClose: () => void;
}) {
  const width = Math.max(1, Math.min(100, terminalWidth - 4));
  const bodyWidth = Math.max(1, width - 4);
  const field =
    state.busy === "suggesting"
      ? "Writing a message…"
      : state.busy === "committing"
        ? `Committing: ${state.message}`
        : `> ${state.message}▏`;

  return (
    <ConfirmDialog
      actions={[
        { keyLabel: "enter", label: "commit", run: onAccept },
        { keyLabel: "esc", label: "keep uncommitted", run: onClose },
      ]}
      height={confirmDialogHeight(4)}
      terminalHeight={terminalHeight}
      terminalWidth={terminalWidth}
      theme={theme}
      title="Commit your edit?"
      width={width}
      onClose={onClose}
    >
      <box style={{ width: "100%", height: 1 }}>
        <text fg={theme.muted}>
          {fitText(`This review ends at a commit, so a reload cannot show your edit.`, bodyWidth)}
        </text>
      </box>
      <box style={{ width: "100%", height: 1 }}>
        <text fg={theme.muted}>
          {fitText(`Commit ${state.path} with this message:`, bodyWidth)}
        </text>
      </box>
      <box style={{ width: "100%", height: 1 }} />
      <box style={{ width: "100%", height: 1 }}>
        <text fg={state.busy === null ? theme.text : theme.muted}>{fitText(field, bodyWidth)}</text>
      </box>
    </ConfirmDialog>
  );
}
