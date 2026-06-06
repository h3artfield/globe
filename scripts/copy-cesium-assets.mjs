import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "node_modules", "cesium", "Build", "Cesium");
const targetRoot = path.join(root, "public", "cesium");

const assetDirs = ["Assets", "ThirdParty", "Workers", "Widgets"];

await mkdir(targetRoot, { recursive: true });

await Promise.all(
  assetDirs.map((dir) =>
    cp(path.join(sourceRoot, dir), path.join(targetRoot, dir), {
      recursive: true,
      force: true,
    }),
  ),
);

console.log(`Copied Cesium assets to ${path.relative(root, targetRoot)}`);
