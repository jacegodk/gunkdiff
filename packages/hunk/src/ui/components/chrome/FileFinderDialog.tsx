import type { MouseEvent as TuiMouseEvent } from "@opentui/core";
import type { FileFinderFile } from "../../fileFinder";
import { listWindowStart } from "../../lib/listWindow";
import { MODAL_FRAME_CHROME_ROWS } from "../../lib/modalGeometry";
import { fitText, padText } from "../../lib/text";
import type { AppTheme } from "../../themes";
import { REVIEW_PICKER_MAX_ROWS } from "./ReviewPickerDialog";
import { ModalFrame } from "./ModalFrame";

/** Query row and the blank row under it, inside the frame's body. */
const FINDER_HEADER_ROWS = 2;

/**
 * gunk: the `t` file finder. A typed query above the matching paths, best match first; the
 * frame keeps a fixed height so it does not jump while the list narrows.
 */
export function FileFinderDialog({
  matches,
  query,
  selectedIndex,
  terminalHeight,
  terminalWidth,
  theme,
  onAcceptItem,
  onClose,
  onSelectItem,
}: {
  matches: readonly FileFinderFile[];
  query: string;
  selectedIndex: number;
  terminalHeight: number;
  terminalWidth: number;
  theme: AppTheme;
  onAcceptItem: (index: number) => void;
  onClose: () => void;
  onSelectItem: (index: number) => void;
}) {
  const width = Math.max(1, Math.min(110, Math.max(56, terminalWidth - 8), terminalWidth - 2));
  const chromeRows = MODAL_FRAME_CHROME_ROWS + FINDER_HEADER_ROWS;
  const visibleRows = Math.max(
    1,
    Math.min(REVIEW_PICKER_MAX_ROWS, terminalHeight - 2 - chromeRows),
  );
  const bodyWidth = Math.max(1, width - 4);
  const windowStart = listWindowStart(selectedIndex, matches.length, visibleRows);
  const visibleMatches = matches.slice(windowStart, windowStart + visibleRows);
  const markerWidth = Math.min(2, bodyWidth);
  const pathWidth = Math.max(0, bodyWidth - markerWidth);

  return (
    <ModalFrame
      height={visibleRows + chromeRows}
      terminalHeight={terminalHeight}
      terminalWidth={terminalWidth}
      theme={theme}
      title="Find a file"
      width={width}
      onClose={onClose}
    >
      <box style={{ width: "100%", height: 1 }}>
        <text fg={theme.text}>{fitText(`> ${query}▏`, bodyWidth)}</text>
      </box>
      <box style={{ width: "100%", height: 1 }} />
      {matches.length === 0 ? (
        <box style={{ width: "100%", height: 1 }}>
          <text fg={theme.muted}>{fitText("No file matches.", bodyWidth)}</text>
        </box>
      ) : null}
      {visibleMatches.map((file, offset) => {
        const index = windowStart + offset;
        const selected = index === selectedIndex;
        return (
          <box
            key={file.id}
            style={{
              width: "100%",
              height: 1,
              flexDirection: "row",
              backgroundColor: selected ? theme.accentMuted : theme.panel,
            }}
            onMouseOver={() => onSelectItem(index)}
            onMouseUp={(event: TuiMouseEvent) => {
              event.stopPropagation();
              onAcceptItem(index);
            }}
          >
            <text fg={selected ? theme.text : theme.muted}>
              {padText(selected ? "›" : " ", markerWidth)}
            </text>
            <text fg={selected ? theme.text : theme.muted}>
              {padText(fitText(file.path, pathWidth), pathWidth)}
            </text>
          </box>
        );
      })}
    </ModalFrame>
  );
}
