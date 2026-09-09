import fs from "node:fs";
import path from "node:path";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ""; }
    else if (char === '\n') { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }

  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((cell) => cell !== ""));
  return body.map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""])));
}

const root = process.cwd();
const input = process.argv[2] || path.join(root, "data", "gocreate-master-2026-09-09.csv");
const rows = parseCsv(fs.readFileSync(input, "utf8"));

const truthy = (v) => String(v).toLowerCase() === "true";
const num = (v) => (v === "" || v == null ? null : Number(v));
const nullable = (v) => (v === "" || v == null ? null : v);
const summaryFields = ["id","displayName","membershipStatus","membershipType","studentAffiliation","dataQualityStatus","isEmployee","isAdmin","isSuperAdmin","active","doorAccessDesired","doorAccessSource","visitsInRange","totalVisits","lastVisitAt","hostedGuestsInRange","membershipSubmittedAt","membershipExpiresAt","membershipSource"];
const detailFields = ["id","displayName","firstName","lastName","email","phone","badgeNumber","dataQualityStatus","dataQualityReason","membershipStatus","membershipStatusRaw","membershipType","membershipTypeRaw","membershipTypes","membershipSubmittedAt","membershipExpiresAt","studentAffiliation","gender","age","ageBand","isEmployee","staffRole","primaryArea","adminRole","isAdmin","isSuperAdmin","active","doorAccessDesired","doorAccessSource","autoPay","paymentStatus","paymentPlan","amountPaid","visitsInRange","totalVisits","lastVisitAt","hostedGuestsInRange","membershipSource"];
const boolFields = new Set(["isEmployee","isAdmin","isSuperAdmin","active","doorAccessDesired"]);
const numberFields = new Set(["badgeNumber","age","paymentStatus","paymentPlan","amountPaid","visitsInRange","totalVisits","hostedGuestsInRange"]);
const normalize = (row, field) => {
  if (boolFields.has(field)) return truthy(row[field]);
  if (numberFields.has(field)) return num(row[field]);
  return nullable(row[field]);
};

const summaries = rows.map((row) => Object.fromEntries(summaryFields.map((f) => [f, normalize(row, f)])));
const details = Object.fromEntries(rows.map((row) => [row.id, Object.fromEntries(detailFields.map((f) => [f, normalize(row, f)]))]));

fs.mkdirSync(path.join(root, "src", "data"), { recursive: true });
fs.writeFileSync(path.join(root, "src", "data", "members-summary.json"), JSON.stringify(summaries));
fs.writeFileSync(path.join(root, "src", "data", "member-details.json"), JSON.stringify(details));
fs.writeFileSync(path.join(root, "src", "data", "dataset-meta.json"), JSON.stringify({ sourceFile: path.basename(input), generatedAt: new Date().toISOString(), rowCount: rows.length, columnCount: Object.keys(rows[0] || {}).length }, null, 2));
console.log(`Prepared ${rows.length} members from ${path.basename(input)}.`);
