import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const forwardedArgs = process.argv.slice(2);
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  command,
  ["tsx", path.join(scriptDir, "validate_manual_imports.ts"), ...forwardedArgs],
  { stdio: "inherit", shell: true },
);

process.exit(result.status ?? 1);
