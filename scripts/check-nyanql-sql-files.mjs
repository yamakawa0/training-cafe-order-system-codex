#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiPath = path.join(rootDir, "backend/nyanql/api.json");
const apiDir = path.dirname(apiPath);
const api = JSON.parse(fs.readFileSync(apiPath, "utf8"));
let failed = false;

for (const [name, definition] of Object.entries(api)) {
  const sqlFiles = definition && definition.sql;
  if (!Array.isArray(sqlFiles) || sqlFiles.length === 0) {
    console.error(`NG: ${name} has no sql file list`);
    failed = true;
    continue;
  }

  for (const sqlFile of sqlFiles) {
    if (typeof sqlFile !== "string" || sqlFile.trim() === "") {
      console.error(`NG: ${name} has an invalid sql file entry`);
      failed = true;
      continue;
    }

    const sqlPath = path.resolve(apiDir, sqlFile);
    if (fs.existsSync(sqlPath) && fs.statSync(sqlPath).isFile()) {
      console.log(`OK: ${name} -> ${path.relative(rootDir, sqlPath)}`);
    } else {
      console.error(`NG: ${name} SQL is missing: ${path.relative(rootDir, sqlPath)}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error("FAIL: NyanQL api.json SQL consistency");
  process.exit(1);
}

console.log("PASS: NyanQL api.json SQL consistency");
