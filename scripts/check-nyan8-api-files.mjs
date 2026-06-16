#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiPath = path.join(rootDir, "backend/nyan8/api.json");
const apiDir = path.dirname(apiPath);
const api = JSON.parse(fs.readFileSync(apiPath, "utf8"));
let failed = false;

for (const [name, definition] of Object.entries(api)) {
  if (!definition || typeof definition.script !== "string" || definition.script.trim() === "") {
    console.error(`NG: ${name} has no script`);
    failed = true;
    continue;
  }

  const scriptPath = path.resolve(apiDir, definition.script);
  if (fs.existsSync(scriptPath) && fs.statSync(scriptPath).isFile()) {
    console.log(`OK: ${name} -> ${path.relative(rootDir, scriptPath)}`);
  } else {
    console.error(`NG: ${name} script is missing: ${path.relative(rootDir, scriptPath)}`);
    failed = true;
  }
}

if (failed) {
  console.error("FAIL: Nyan8 api.json file consistency");
  process.exit(1);
}

console.log("PASS: Nyan8 api.json file consistency");
