import type { CliInput } from "../../core/run/commandInputs";

/** Longest diff handed to the message writer; a larger edit is cut, which still names its gist. */
const MAX_DIFF_CHARS = 20_000;
const SUGGEST_TIMEOUT_MS = 60_000;

/**
 * gunk: tell whether a review ends at a commit (or at the index), so an editor save in the working
 * tree can never show on reload. `gunk diff origin/develop HEAD`, `A..B`, `--staged` and `show`
 * qualify; `gunk diff origin/develop` compares against the working tree and does not.
 */
export function reviewEndsAtCommit(input: CliInput) {
  if (input.kind === "show" || input.kind === "stash-show") return true;
  if (input.kind !== "vcs") return false;
  return (
    input.staged || input.rangeEndpoints !== undefined || (input.range?.includes("..") ?? false)
  );
}

async function run(args: string[], cwd: string, stdin?: string, timeout?: number) {
  const child = Bun.spawn(args, {
    cwd,
    timeout,
    stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, exitCode };
}

/** True when `path` differs from HEAD in a git repo; false for a clean file or a non-git source. */
export async function fileHasUncommittedEdit(repoRoot: string, path: string) {
  try {
    // Outside a repo git exits 128; an untracked file ("??") cannot be committed by path.
    const { exitCode, stdout } = await run(["git", "status", "--porcelain", "--", path], repoRoot);
    const status = stdout.trim();
    return exitCode === 0 && status !== "" && !status.startsWith("??");
  } catch {
    return false;
  }
}

/** First line of the writer's reply, without quotes or code ticks it sometimes adds. */
export function cleanSuggestedMessage(reply: string) {
  const line = reply
    .split("\n")
    .map((text) => text.trim())
    .find((text) => text.length > 0);
  return line?.replace(/^["'`]+|["'`]+$/g, "").trim() ?? "";
}

/**
 * Ask `claude -p` for a one-line commit subject for the edit, in the style of the repo's recent
 * subjects. Any failure (no `claude` on PATH, timeout, empty reply) falls back to `update <path>`.
 */
export async function suggestCommitMessage(repoRoot: string, path: string) {
  const fallback = `update ${path}`;
  try {
    const [diff, log] = await Promise.all([
      run(["git", "diff", "HEAD", "--", path], repoRoot),
      run(["git", "log", "--format=%s", "-10"], repoRoot),
    ]);
    const prompt = [
      "Write a one-line git commit subject for the diff on stdin.",
      "Match the style of these recent subjects from the same repo:",
      log.stdout.trim(),
      "Reply with the subject line only.",
    ].join("\n");
    const reply = await run(
      ["claude", "-p", "--model", "haiku", prompt],
      repoRoot,
      diff.stdout.slice(0, MAX_DIFF_CHARS),
      SUGGEST_TIMEOUT_MS,
    );
    if (reply.exitCode !== 0) return fallback;
    return cleanSuggestedMessage(reply.stdout) || fallback;
  } catch {
    return fallback;
  }
}

/** Commit only `path` (other staged files stay staged). Returns git's error text, or null. */
export async function commitFile(repoRoot: string, path: string, message: string) {
  try {
    const { exitCode, stderr, stdout } = await run(
      ["git", "commit", "-m", message, "--", path],
      repoRoot,
    );
    if (exitCode === 0) return null;
    const detail = (stderr.trim() || stdout.trim()).split("\n").at(-1);
    return `Commit failed: ${detail || `git exited with status ${exitCode}`}`;
  } catch (error) {
    return `Commit failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}
