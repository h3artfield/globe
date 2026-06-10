import path from "node:path";
import { repoPath } from "@/lib/pipeline/io";

const ALLOWED_EXTENSIONS = new Set([
  ".json",
  ".jsonl",
  ".csv",
  ".md",
  ".markdown",
  ".txt",
]);

export function assertSafeLocalPath(localPath: string): void {
  const normalized = localPath.replaceAll("\\", "/").trim();
  if (!normalized) {
    throw new Error("Local path is required.");
  }
  if (normalized.includes("..")) {
    throw new Error("Path traversal (..) is not allowed in local paths.");
  }
  if (path.isAbsolute(normalized)) {
    throw new Error("Absolute paths are not allowed; use a repo-relative path.");
  }
}

export function resolveSafeLocalPath(localPath: string): string {
  assertSafeLocalPath(localPath);
  const repoRoot = repoPath();
  const resolved = path.resolve(repoRoot, localPath.replace(/^[/\\]+/, ""));
  const relativeToRoot = path.relative(repoRoot, resolved);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Local path must stay within the repository root.");
  }
  return resolved;
}

export function assertSupportedExtension(resolvedPath: string): void {
  const ext = path.extname(resolvedPath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file extension "${ext || "(none)"}". Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
    );
  }
}
