/**
 * gunk: the file finder behind `t`, as in GitLab's merge request view. Matches the review's
 * visible files by path and ranks them so the file you mean comes first.
 */

/** One file the finder can jump to. */
export interface FileFinderFile {
  id: string;
  path: string;
}

/**
 * Rank of `path` for `query`, lower first, or null when it does not match.
 *
 * A match in the file's own name beats one elsewhere in the path, a contiguous match beats a
 * scattered one, and among equals the shorter path wins. Case is ignored.
 */
function rankPath(path: string, query: string): number | null {
  const haystack = path.toLowerCase();
  const name = haystack.slice(haystack.lastIndexOf("/") + 1);
  if (name.includes(query)) return 0;
  if (haystack.includes(query)) return 1;
  let from = 0;
  for (const char of query) {
    const found = haystack.indexOf(char, from);
    if (found === -1) return null;
    from = found + 1;
  }
  return 2;
}

/** Files matching `query` in rank order; every file in review order when the query is blank. */
export function findFiles<T extends FileFinderFile>(files: readonly T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...files];
  return files
    .flatMap((file) => {
      const rank = rankPath(file.path, needle);
      return rank === null ? [] : [{ file, rank }];
    })
    .sort((a, b) => a.rank - b.rank || a.file.path.length - b.file.path.length)
    .map(({ file }) => file);
}
