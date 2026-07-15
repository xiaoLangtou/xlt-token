import { readdirSync, readFileSync, statSync } from "node:fs";
import { delimiter, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const [taskList, ...selectors] = process.argv.slice(2);

if (!taskList || selectors.length === 0) {
  console.error(
    "Usage: node scripts/run-workspace-task.mjs <task[,task...]> <packages|examples|path...>",
  );
  process.exit(1);
}

const tasks = taskList
  .split(",")
  .map((task) => task.trim())
  .filter(Boolean);
const packageDirs = resolveSelectors(selectors);
const binPath = [resolve(root, "node_modules/.bin"), process.env.PATH]
  .filter(Boolean)
  .join(delimiter);

for (const task of tasks) {
  for (const dir of packageDirs) {
    const manifest = readManifest(dir);
    const command = manifest.scripts?.[task];
    if (!command) continue;

    console.log(`\n> ${manifest.name} ${task}`);
    const result = spawnSync(command, {
      cwd: dir,
      env: {
        ...process.env,
        PATH: [resolve(dir, "node_modules/.bin"), binPath].join(delimiter),
      },
      shell: true,
      stdio: "inherit",
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

function resolveSelectors(values) {
  const dirs = [];
  for (const value of values) {
    if (value === "packages" || value === "examples") {
      dirs.push(...workspaceDirs(value));
    } else {
      dirs.push(resolve(root, value));
    }
  }

  return [...new Set(dirs)].toSorted((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

function workspaceDirs(parent) {
  const parentDir = resolve(root, parent);
  return readdirSync(parentDir)
    .map((name) => resolve(parentDir, name))
    .filter((dir) => statSync(dir).isDirectory())
    .filter((dir) => hasManifest(dir));
}

function sortKey(dir) {
  const manifest = readManifest(dir);
  const order = [
    "@xlt-token/core",
    "@xlt-token/store-contract",
    "@xlt-token/jwt",
    "@xlt-token/store-redis",
    "@xlt-token/express",
    "@xlt-token/nestjs",
  ];
  const index = order.indexOf(manifest.name);
  return `${index === -1 ? 99 : index}:${manifest.name}`;
}

function hasManifest(dir) {
  try {
    readManifest(dir);
    return true;
  } catch {
    return false;
  }
}

function readManifest(dir) {
  return JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8"));
}
