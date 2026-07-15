import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const packagesRoot = path.join(repoRoot, "packages");

const packageRules = new Map([
  ["@xlt-token/core", new Set(["@xlt-token/core"])],
  ["@xlt-token/jwt", new Set(["@xlt-token/core", "@xlt-token/jwt"])],
  ["@xlt-token/store-contract", new Set(["@xlt-token/core", "@xlt-token/store-contract"])],
  ["@xlt-token/store-redis", new Set(["@xlt-token/core", "@xlt-token/store-redis"])],
  ["@xlt-token/express", new Set(["@xlt-token/core", "@xlt-token/express"])],
  [
    "@xlt-token/nestjs",
    new Set(["@xlt-token/core", "@xlt-token/jwt", "@xlt-token/store-redis", "@xlt-token/nestjs"]),
  ],
]);

const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "dist" || entry.name === "coverage" || entry.name === "node_modules")
        continue;
      files.push(...(await listFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function isPackageSourceEscape(specifier, filePath, packageDir) {
  if (!specifier.startsWith(".")) return false;

  const resolved = path.resolve(path.dirname(filePath), specifier);
  const relativeToPackage = path.relative(packageDir, resolved);
  const relativeToRepo = toPosix(path.relative(repoRoot, resolved));

  return relativeToPackage.startsWith("..") && relativeToRepo.includes("/src/");
}

function findImports(source) {
  const imports = [];
  let match;

  while ((match = importPattern.exec(source))) {
    imports.push(match[1] ?? match[2]);
  }

  return imports;
}

const packageDirs = (await readdir(packagesRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(packagesRoot, entry.name));

const failures = [];

for (const packageDir of packageDirs) {
  const packageJsonPath = path.join(packageDir, "package.json");
  const packageJson = await readJson(packageJsonPath);
  const packageName = packageJson.name;
  const allowedPackages = packageRules.get(packageName);

  if (!allowedPackages) {
    failures.push(`${packageName}: missing package boundary rule`);
    continue;
  }

  const files = await listFiles(path.join(packageDir, "src"));

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");
    const relativeFile = toPosix(path.relative(repoRoot, filePath));

    for (const specifier of findImports(source)) {
      if (specifier.includes("/src/") || specifier.match(/^@xlt-token\/[^/]+\/src(?:\/|$)/)) {
        failures.push(`${relativeFile}: imports internal source path "${specifier}"`);
      }

      if (specifier.startsWith("@xlt-token/")) {
        const importedPackage = specifier.split("/").slice(0, 2).join("/");
        if (!allowedPackages.has(importedPackage)) {
          failures.push(`${relativeFile}: ${packageName} cannot import ${importedPackage}`);
        }
      }

      if (isPackageSourceEscape(specifier, filePath, packageDir)) {
        failures.push(
          `${relativeFile}: relative import escapes package source boundary via "${specifier}"`,
        );
      }
    }
  }
}

if (failures.length) {
  console.error("Package boundary check failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Package boundary check passed.");
