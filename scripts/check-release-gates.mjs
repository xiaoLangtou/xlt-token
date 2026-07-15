import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifestPaths = [
  "package.json",
  "packages/core/package.json",
  "packages/express/package.json",
  "packages/jwt/package.json",
  "packages/nestjs/package.json",
  "packages/store-contract/package.json",
  "packages/store-redis/package.json",
  "examples/express/package.json",
  "examples/nestjs/package.json",
];

const manifests = manifestPaths.map((path) => [path, readJson(path)]);
const rootManifest = manifests[0][1];
const releaseVersion = rootManifest.version;
const internalNames = new Set(
  manifests
    .map(([, manifest]) => manifest.name)
    .filter((name) => name === "xlt-token" || name?.startsWith("@xlt-token/")),
);

for (const [path, manifest] of manifests) {
  if (manifest.version !== releaseVersion) {
    fail(`${path} version ${manifest.version} does not match root ${releaseVersion}.`);
  }

  for (const blockName of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    const block = manifest[blockName] ?? {};
    for (const [name, range] of Object.entries(block)) {
      if (!internalNames.has(name) || name === manifest.name) continue;
      if (range !== `^${releaseVersion}` && !String(range).startsWith("workspace:")) {
        fail(
          `${path} ${blockName}.${name} must be ^${releaseVersion} or workspace:, got ${range}.`,
        );
      }
    }
  }
}

if (rootManifest.packageManager !== "pnpm@10.15.1") {
  fail(`packageManager must stay pinned to pnpm@10.15.1, got ${rootManifest.packageManager}.`);
}

const changelog = read("CHANGELOG.md");
if (!changelog.includes(`## [${releaseVersion}]`)) {
  fail(`CHANGELOG.md is missing release section ## [${releaseVersion}].`);
}

for (const path of [
  "docs/guide/migration-2-0.md",
  "docs/core/storage.md",
  "docs/core/jwt-strategy.md",
  "docs/core/hooks-and-observability.md",
]) {
  if (!existsSync(resolve(root, path))) {
    fail(`Required release documentation is missing: ${path}`);
  }
}

console.log(`Release gate check passed for ${releaseVersion}.`);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
