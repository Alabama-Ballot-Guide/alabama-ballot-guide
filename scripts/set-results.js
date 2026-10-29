#!/usr/bin/env node
// set-results.js: copy election night numbers from the Secretary of State into data.js.
// Zero dependencies. Like the other tools, it reads data.js as JSON text and never runs it.
//
// 1. Print a sheet to fill in, one line per name, with the current numbers:
//      node scripts/set-results.js --template > results.csv
// 2. Type each number exactly as the state's results page shows it (commas are fine), plus the
//    page's reporting line for each contest. Leave a line out to keep its current value.
// 3. Write it into data.js, with the time you copied the numbers (Central) and the page you copied from:
//      node scripts/set-results.js --csv results.csv --status counting --as-of 2026-11-03T21:42 \
//        --source-url "https://www2.alabamavotes.gov/electionNight/statewideResultsByContest.aspx?ecode=..."
// 4. Run validate-data.js, then open a pull request. Merging publishes.
//
// Sheet columns: contest id, name, value. The name is a candidate's ballot name, "Yes" or "No" for an
// amendment, "Write-in" for write-in votes, or "Reporting" for the reporting line (e.g. "64 of 67 counties").
"use strict";
const fs = require("fs");
const path = require("path");

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith("--")) continue;
  const k = a.slice(2), v = process.argv[i + 1];
  if (v === undefined || v.startsWith("--")) args[k] = true; else { args[k] = v; i++; }
}
const file = path.resolve(args.data || path.join(__dirname, "..", "data.js"));
const PREFIX = "window.GUIDE = ";
const raw = fs.readFileSync(file, "utf8");
if (!raw.startsWith(PREFIX) || !raw.endsWith(";\n")) fail("data.js must be exactly `window.GUIDE = <JSON>;`");
const G = JSON.parse(raw.slice(PREFIX.length, -2));
if (!G.results) fail("data.js has no results section");
const R = G.results;

function fail(m) { console.error("set-results: " + m); process.exit(1); }
const q = s => (/[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
// one CSV line: quoted fields may hold commas ("1,234") and doubled quotes
function cells(line) {
  const out = []; let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') inQ = false; else cur += c; }
    else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

if (args.template) {
  const lines = ["contest,name,value"];
  R.contests.forEach(c => {
    c.votes.forEach(v => lines.push([c.id, v.name, String(v.votes)].map(q).join(",")));
    if (!/^amendment-/.test(c.id)) lines.push([c.id, "Write-in", String(c.writeIn)].map(q).join(","));
    lines.push([c.id, "Reporting", c.reporting].map(q).join(","));
  });
  process.stdout.write(lines.join("\n") + "\n");
  process.exit(0);
}

if (!args.csv && !args.status) fail("nothing to do: pass --template, or --csv and/or --status");
if (args.status) {
  if (!["before", "counting", "unofficial", "certified"].includes(args.status)) fail("--status must be before, counting, unofficial or certified");
  R.status = args.status;
}
if (args["as-of"]) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(args["as-of"])) fail("--as-of must look like 2026-11-03T21:42 (Central time)");
  R.asOf = args["as-of"];
} else if (args.csv) fail("--as-of is required with --csv: the time you copied the numbers, Central");
if (args["source-url"]) R.source = [{ label: args["source-label"] || R.source[0].label, url: args["source-url"] }];

if (args.csv) {
  const byId = new Map(R.contests.map(c => [c.id, c]));
  const rows = fs.readFileSync(args.csv, "utf8").split(/\r?\n/).filter(l => l.trim());
  let n = 0;
  rows.forEach((line, i) => {
    const [id, name, value] = cells(line);
    if (i === 0 && id === "contest") return;
    const c = byId.get(id);
    if (!c) fail("line " + (i + 1) + ": unknown contest " + JSON.stringify(id));
    if (name === "Reporting") { c.reporting = value; n++; return; }
    const num = Number(String(value).replace(/,/g, ""));
    if (!Number.isInteger(num) || num < 0) fail("line " + (i + 1) + ": " + JSON.stringify(value) + " is not a whole number of votes");
    if (name === "Write-in") {
      if (/^amendment-/.test(id)) fail("line " + (i + 1) + ": an amendment has no write-in votes");
      c.writeIn = num; n++; return;
    }
    const v = c.votes.find(x => x.name === name);
    if (!v) fail("line " + (i + 1) + ": " + JSON.stringify(name) + " is not on the ballot for " + id + " (expected " + c.votes.map(x => x.name).join(", ") + ")");
    v.votes = num; n++;
  });
  console.log("set " + n + " values from " + args.csv);
}
fs.writeFileSync(file, PREFIX + JSON.stringify(G, null, 2) + ";\n");
console.log("results: " + R.status + (R.asOf ? ", as of " + R.asOf + " Central" : "") + ". Now run validate-data.js.");
