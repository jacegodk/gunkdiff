import type { AppCommand } from "../../lib/appCommands";
import { buildHelpSections, type HelpSection } from "../../lib/helpContent";
import { fitText, padText } from "../../lib/text";
import type { AppTheme } from "../../themes";
import { ModalFrame } from "./ModalFrame";

/**
 * Render the in-app controls help modal.
 *
 * The rows come from the command table, so what the dialog shows is what the
 * session's keys actually do, remapped or not.
 */
export function HelpDialog({
  commands,
  sections: suppliedSections,
  terminalHeight,
  terminalWidth,
  theme,
  onClose,
}: {
  commands?: readonly AppCommand[];
  sections?: readonly HelpSection[];
  terminalHeight: number;
  terminalWidth: number;
  theme: AppTheme;
  onClose: () => void;
}) {
  const sections = suppliedSections ? [...suppliedSections] : buildHelpSections(commands ?? []);

  const rows = sections.flatMap((section) => section.rows);
  const longestKeys = Math.max(0, ...rows.map((row) => row.keys.length));
  const longestDescription = Math.max(0, ...rows.map((row) => row.description.length));
  // gunk: one column is as wide as the longest key and description need, so neither is cut short.
  const columnWidth = Math.max(52, longestKeys + 1 + longestDescription);
  // gunk: a terminal with room for two columns gets them, so the whole list fits without
  // scrolling; the sections split where the two columns come out closest in height.
  const columnGap = 4;
  const twoColumns = sections.length > 1 && terminalWidth - 2 >= 2 * columnWidth + columnGap + 4;
  const sectionHeight = (section: HelpSection) => 1 + section.rows.length;
  const stackHeight = (stack: readonly HelpSection[]) =>
    stack.reduce((total, section) => total + sectionHeight(section), 0) +
    Math.max(0, stack.length - 1);
  let splitAt = sections.length;
  if (twoColumns) {
    let best = Number.POSITIVE_INFINITY;
    for (let index = 1; index < sections.length; index += 1) {
      const tallest = Math.max(
        stackHeight(sections.slice(0, index)),
        stackHeight(sections.slice(index)),
      );
      if (tallest < best) {
        best = tallest;
        splitAt = index;
      }
    }
  }
  const columns = twoColumns ? [sections.slice(0, splitAt), sections.slice(splitAt)] : [sections];
  const width = Math.max(
    1,
    Math.min(
      columns.length * columnWidth + (columns.length - 1) * columnGap + 4,
      terminalWidth - 2,
    ),
  );
  const bodyWidth = Math.max(1, width - 4);
  const stackWidth = Math.max(
    1,
    Math.floor((bodyWidth - (columns.length - 1) * columnGap) / columns.length),
  );
  // Key text is user-controlled once bindings are, so the column is measured
  // rather than guessed — but descriptions are given the room they need first,
  // since a truncated key is still recognizable and a truncated sentence is not.
  const keyWidth = Math.max(
    1,
    Math.min(
      stackWidth,
      Math.max(
        Math.min(12, stackWidth),
        Math.min(longestKeys + 1, stackWidth - longestDescription),
      ),
    ),
  );
  const descriptionWidth = Math.max(0, stackWidth - keyWidth);
  const contentRowCount = Math.max(...columns.map(stackHeight));
  // ModalFrame contributes the border rows, title row, padding, and one blank spacer row.
  const modalFrameChromeRowCount = 6;
  const requiredModalHeight = contentRowCount + modalFrameChromeRowCount;
  const modalHeight = Math.max(1, Math.min(requiredModalHeight, terminalHeight - 2));
  const shouldScroll = modalHeight < requiredModalHeight;
  const renderStack = (stack: readonly HelpSection[]) => (
    <box style={{ width: stackWidth, flexDirection: "column" }}>
      {stack.map((section, sectionIndex) => (
        <box key={section.title} style={{ width: "100%", flexDirection: "column" }}>
          <box style={{ width: "100%", height: 1 }}>
            <text fg={theme.badgeNeutral}>{section.title}</text>
          </box>
          {section.rows.map((row) => (
            <box
              key={`${section.title}:${row.description}`}
              style={{ width: "100%", height: 1, flexDirection: "row" }}
            >
              <text fg={theme.accent}>{padText(fitText(row.keys, keyWidth), keyWidth)}</text>
              <text fg={theme.muted}>{fitText(row.description, descriptionWidth)}</text>
            </box>
          ))}
          {sectionIndex < stack.length - 1 ? <box style={{ width: "100%", height: 1 }} /> : null}
        </box>
      ))}
    </box>
  );
  const content = (
    <box style={{ width: "100%", flexDirection: "row", columnGap }}>
      {columns.map((stack, index) => (
        <box key={index} style={{ flexDirection: "column" }}>
          {renderStack(stack)}
        </box>
      ))}
    </box>
  );

  return (
    <ModalFrame
      height={modalHeight}
      terminalHeight={terminalHeight}
      terminalWidth={terminalWidth}
      theme={theme}
      title="Controls help"
      width={width}
      onClose={onClose}
    >
      {shouldScroll ? (
        <scrollbox focused={true} height="100%" scrollY={true} width="100%">
          {content}
        </scrollbox>
      ) : (
        content
      )}
    </ModalFrame>
  );
}
