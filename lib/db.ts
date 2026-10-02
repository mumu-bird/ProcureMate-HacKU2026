import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { Product, Inventory, Order, Mandate, Quote } from "./types";

const root = process.cwd();
const dbPath =
  process.env.PROCUREMATE_DB || join(root, "data", "procuremate.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });
const globalDb = globalThis as typeof globalThis & {
  procurementDb?: DatabaseSync;
};
export const db = globalDb.procurementDb || new DatabaseSync(dbPath);
globalDb.procurementDb = db;
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS documents (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,id));
CREATE TABLE IF NOT EXISTS inventory (product_id TEXT PRIMARY KEY, quantity INTEGER NOT NULL CHECK(quantity>=0), safety INTEGER NOT NULL, target INTEGER NOT NULL, unit TEXT NOT NULL, sample INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS movements (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, delta INTEGER NOT NULL, reason TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS usage (order_id TEXT PRIMARY KEY, mandate_id TEXT NOT NULL, amount INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('reserved','spent','released')));
CREATE TABLE IF NOT EXISTS audit (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, detail TEXT NOT NULL, previous_hash TEXT NOT NULL, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, actor TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS payment_events (id TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mock_payments (id TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS measurements (id TEXT PRIMARY KEY, body TEXT NOT NULL);
`);

export function now() {
  return new Date().toISOString();
}
export function id(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 12)}`;
}
export function put<T extends { id: string }>(kind: string, value: T) {
  db.prepare(
    "INSERT INTO documents(kind,id,body) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body",
  ).run(kind, value.id, JSON.stringify(value));
}
export function get<T>(kind: string, key: string): T | undefined {
  const r = db
    .prepare("SELECT body FROM documents WHERE kind=? AND id=?")
    .get(kind, key) as { body: string } | undefined;
  return r ? JSON.parse(r.body) : undefined;
}
export function list<T>(kind: string): T[] {
  return (
    db
      .prepare("SELECT body FROM documents WHERE kind=? ORDER BY rowid DESC")
      .all(kind) as { body: string }[]
  ).map((r) => JSON.parse(r.body));
}
export function atomic<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function audit(
  actor: string,
  action: string,
  target: string,
  detail: unknown,
) {
  const previous = db
    .prepare("SELECT hash FROM audit ORDER BY seq DESC LIMIT 1")
    .get() as { hash: string } | undefined;
  const row = {
    id: id("log"),
    at: now(),
    actor,
    action,
    target,
    detail,
    previousHash: previous?.hash || "GENESIS",
  };
  const hash = createHash("sha256").update(JSON.stringify(row)).digest("hex");
  db.prepare(
    "INSERT INTO audit(id,at,actor,action,target,detail,previous_hash,hash) VALUES(?,?,?,?,?,?,?,?)",
  ).run(
    row.id,
    row.at,
    row.actor,
    row.action,
    row.target,
    JSON.stringify(detail),
    row.previousHash,
    hash,
  );
}
type AuditRow = {
  seq: number;
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  previous_hash: string;
  hash: string;
};
export function auditRows() {
  return (
    db.prepare("SELECT * FROM audit ORDER BY seq DESC").all() as AuditRow[]
  ).map((r) => ({ ...r, detail: JSON.parse(r.detail) as unknown }));
}
export function verifyAudit() {
  let previous = "GENESIS";
  for (const raw of [...auditRows()].reverse()) {
    const row = {
      id: raw.id,
      at: raw.at,
      actor: raw.actor,
      action: raw.action,
      target: raw.target,
      detail: raw.detail,
      previousHash: raw.previous_hash,
    };
    if (
      raw.previous_hash !== previous ||
      createHash("sha256").update(JSON.stringify(row)).digest("hex") !==
        raw.hash
    )
      return false;
    previous = String(raw.hash);
  }
  return true;
}
export function products(): Product[] {
  return list<Product>("product");
}
export function usage(mandateId: string) {
  const r = db
    .prepare(
      "SELECT COALESCE(SUM(CASE WHEN state='spent' THEN amount ELSE 0 END),0) spent, COALESCE(SUM(CASE WHEN state='reserved' THEN amount ELSE 0 END),0) reserved FROM usage WHERE mandate_id=?",
    )
    .get(mandateId) as { spent: number; reserved: number };
  return { spent: Number(r.spent), reserved: Number(r.reserved) };
}
export function inventory(): Inventory[] {
  const open = list<Order>("order").filter(
    (o) =>
      !o.receivedAt &&
      [
        "reserved",
        "authorizing",
        "authorized",
        "capturing",
        "paid",
        "pending",
        "refund_pending",
      ].includes(o.status),
  );
  return (
    db.prepare("SELECT * FROM inventory").all() as {
      product_id: string;
      quantity: number;
      safety: number;
      target: number;
      unit: string;
      sample: number;
    }[]
  ).map((r) => {
    const inTransit = open.reduce(
      (n, o) =>
        n +
        o.quote.lines
          .filter((l) => l.productId === r.product_id)
          .reduce((v, l) => v + l.quantity, 0),
      0,
    );
    return {
      productId: r.product_id,
      name: get<Product>("product", r.product_id)?.name || r.product_id,
      quantity: r.quantity,
      safety: r.safety,
      target: r.target,
      unit: r.unit,
      sample: !!r.sample,
      inTransit,
      suggestion:
        r.quantity <= r.safety
          ? Math.max(0, r.target - r.quantity - inTransit)
          : 0,
    };
  });
}
export function snapshot() {
  return {
    products: products(),
    quotes: list<Quote>("quote"),
    mandates: list<Mandate>("mandate").map((m) => ({ ...m, ...usage(m.id) })),
    orders: list<Order>("order"),
    inventory: inventory(),
    audit: auditRows().slice(0, 200),
    auditValid: verifyAudit(),
    paymentProvider:
      process.env.PAYMENT_PROVIDER === "stripe" ? "stripe-test" : "simulated",
    planner: process.env.MODEL_API_KEY ? "model" : "rules",
    measurements: (
      db.prepare("SELECT body FROM measurements").all() as { body: string }[]
    ).map((r) => JSON.parse(r.body)),
  };
}
if (!products().length) {
  const catalog = JSON.parse(
    readFileSync(join(root, "data", "catalog.json"), "utf8"),
  ) as Product[];
  atomic(() => {
    if (products().length) return;
    for (const p of catalog) put("product", p);
    for (const sku of ["coffee-mocha", "coffee-black", "coffee-white"])
      db.prepare("INSERT INTO inventory VALUES(?,?,?,?,?,?)").run(
        sku,
        sku === "coffee-mocha" ? 4 : 12,
        4,
        20,
        "盒",
        1,
      );
    audit("system", "DEMO_INITIALIZED", "workspace", {
      notice: "库存和公司为样例；商品价格为采集快照；无真实商户订单。",
      products: catalog.length,
    });
  });
}
