/** Last path segment (handles both `/` and `\` separators). */
export function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Parent directory (handles both `/` and `\` separators). */
export function parentDir(path: string): string {
  const norm = path.replace(/\\/g, "/").replace(/\/$/, "");
  const idx = norm.lastIndexOf("/");
  return idx > 0 ? norm.slice(0, idx) : norm;
}
