import { randomInt } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { Pool, types, type PoolClient } from "pg";
import { isDemoMode } from "./auth-mode";
import { postgresSchema, postgresConnection, postgresSql } from "./postgres-sql";
import { SOCIETY_COMPLAINTS_SCHEMA } from "./society-complaints-schema";
import { SOCIETY_COMMUNITY_SCHEMA } from "./society-community-schema";
import { SOCIETY_FINANCE_SCHEMA } from "./society-finance-schema";
import { SOCIETY_GATE_SCHEMA } from "./society-gate-schema";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = process.env.JODO_DB ?? path.join(DATA_DIR, isDemoMode() ? "jodo.db" : "jodo-live.db");
const SQLITE_SCHEMA = () => SCHEMA + SOCIETY_COMPLAINTS_SCHEMA + SOCIETY_COMMUNITY_SCHEMA + SOCIETY_FINANCE_SCHEMA + SOCIETY_GATE_SCHEMA;

export function usesPostgres() {
  return Boolean(process.env.DATABASE_URL);
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS society (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, locality TEXT NOT NULL, city TEXT NOT NULL,
  flatCount INTEGER NOT NULL, approvalRequired INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY, phone TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'resident', vendorId TEXT,
  lang TEXT NOT NULL DEFAULT 'en'
);

CREATE TABLE IF NOT EXISTS residency (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL, societyId TEXT NOT NULL,
  flat TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'owner',
  status TEXT NOT NULL DEFAULT 'pending', verifiedVia TEXT, createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guard_assignment (
  userId TEXT PRIMARY KEY REFERENCES user(id),
  societyId TEXT NOT NULL REFERENCES society(id),
  isActive INTEGER NOT NULL DEFAULT 1 CHECK (isActive IN (0, 1))
);

CREATE TABLE IF NOT EXISTS vendor (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, rating REAL NOT NULL DEFAULT 4.5,
  jobsDone INTEGER NOT NULL DEFAULT 0, badges TEXT NOT NULL DEFAULT '[]', city TEXT NOT NULL,
  -- the services this vendor actually does; a group can only be given to one of them
  skuIds TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS sku (
  id TEXT PRIMARY KEY, category TEXT NOT NULL, name TEXT NOT NULL,
  unit TEXT NOT NULL, unitLabel TEXT NOT NULL, listPricePaise INTEGER NOT NULL,
  durationMin INTEGER NOT NULL, included TEXT NOT NULL, excluded TEXT NOT NULL,
  warrantyDays INTEGER NOT NULL, mvsDefault INTEGER NOT NULL, season TEXT NOT NULL,
  defaultSlabs TEXT NOT NULL,
  -- how many units one crew can serve in a two-hour slot, and how often a
  -- society comes back to this service
  unitsPerSlot INTEGER NOT NULL DEFAULT 8, repeatMonths INTEGER NOT NULL DEFAULT 0,
  -- does the ladder count flats, or units? 50 cars in one tower move a vendor's
  -- economics even when they belong to 30 flats.
  ladderBasis TEXT NOT NULL DEFAULT 'flats'
);

CREATE TABLE IF NOT EXISTS deal (
  id TEXT PRIMARY KEY, societyId TEXT NOT NULL, skuId TEXT NOT NULL, vendorId TEXT NOT NULL,
  createdBy TEXT NOT NULL, serviceDate TEXT NOT NULL, slotWindows TEXT NOT NULL,
  status TEXT NOT NULL, joinDeadline TEXT NOT NULL, targetFlats INTEGER NOT NULL,
  mvs INTEGER NOT NULL, listPricePaise INTEGER NOT NULL, slabs TEXT NOT NULL,
  createdAt TEXT NOT NULL, lockedAt TEXT, approvedBy TEXT,
  -- the lowest price this deal has ever offered. Once reached it is never
  -- given back, so a member leaving can't push the price up for everyone else.
  floorPricePaise INTEGER,
  -- set once when a close group gets its one automatic 48h extension
  extendedAt TEXT
);

CREATE TABLE IF NOT EXISTS deal_member (
  id TEXT PRIMARY KEY, dealId TEXT NOT NULL, userId TEXT NOT NULL, flat TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1, slot TEXT NOT NULL, paymentMethod TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'joined', finalPricePaise INTEGER, joinedAt TEXT NOT NULL,
  UNIQUE (dealId, userId)
);

CREATE TABLE IF NOT EXISTS comment (
  id TEXT PRIMARY KEY, dealId TEXT NOT NULL, userId TEXT NOT NULL,
  body TEXT NOT NULL, createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deal_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT, dealId TEXT NOT NULL, type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}', createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job (
  id TEXT PRIMARY KEY, dealId TEXT NOT NULL, memberId TEXT NOT NULL, flat TEXT NOT NULL,
  technician TEXT NOT NULL, slot TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled',
  startOtp TEXT NOT NULL, endOtp TEXT NOT NULL, startedAt TEXT, finishedAt TEXT,
  ratingScore INTEGER, ratingNote TEXT
);

CREATE TABLE IF NOT EXISTS session (
  token TEXT PRIMARY KEY, userId TEXT NOT NULL, createdAt TEXT NOT NULL,
  expiresAt TEXT
);

CREATE TABLE IF NOT EXISTS google_identity (
  subject TEXT PRIMARY KEY,
  userId TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS google_link (
  id TEXT PRIMARY KEY, tokenHash TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL, email TEXT NOT NULL, expiresAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_identity (
  subject TEXT PRIMARY KEY,
  userId TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_link (
  id TEXT PRIMARY KEY, tokenHash TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL, email TEXT NOT NULL, expiresAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL, dealId TEXT, type TEXT NOT NULL,
  title TEXT NOT NULL, body TEXT NOT NULL, createdAt TEXT NOT NULL, readAt TEXT, gateVisitId TEXT, residencyId TEXT
);

CREATE TABLE IF NOT EXISTS payment (
  id TEXT PRIMARY KEY, memberId TEXT NOT NULL, dealId TEXT NOT NULL,
  type TEXT NOT NULL,            -- authorisation | capture | release | refund
  method TEXT NOT NULL, amountPaise INTEGER NOT NULL,
  status TEXT NOT NULL, ref TEXT NOT NULL, createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dispute (
  id TEXT PRIMARY KEY, jobId TEXT NOT NULL, dealId TEXT NOT NULL, userId TEXT NOT NULL,
  reason TEXT NOT NULL, detail TEXT NOT NULL, status TEXT NOT NULL,
  resolution TEXT, amountPaise INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL, resolvedAt TEXT
);

CREATE TABLE IF NOT EXISTS revisit (
  id TEXT PRIMARY KEY,
  disputeId TEXT NOT NULL UNIQUE REFERENCES dispute(id),
  status TEXT NOT NULL DEFAULT 'awaiting_schedule',
  serviceDate TEXT, slot TEXT NOT NULL DEFAULT '',
  startOtp TEXT NOT NULL, endOtp TEXT NOT NULL,
  createdAt TEXT NOT NULL, startedAt TEXT, finishedAt TEXT
);

CREATE TABLE IF NOT EXISTS analytics_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT, name TEXT NOT NULL,
  props TEXT NOT NULL DEFAULT '{}', createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lead (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,              -- society | vendor
  name TEXT NOT NULL, phone TEXT NOT NULL, org TEXT NOT NULL, city TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'new', createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_user ON notification(userId, readAt);
CREATE INDEX IF NOT EXISTS idx_session_expiry ON session(expiresAt);
CREATE INDEX IF NOT EXISTS idx_google_link_expiry ON google_link(expiresAt);
CREATE INDEX IF NOT EXISTS idx_email_link_expiry ON email_link(expiresAt);
CREATE INDEX IF NOT EXISTS idx_residency_user ON residency(userId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_residency_verified_flat
  ON residency(societyId, flat) WHERE status = 'verified';
CREATE UNIQUE INDEX IF NOT EXISTS idx_residency_current_user
  ON residency(userId) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_lead_kind ON lead(kind, createdAt);
CREATE INDEX IF NOT EXISTS idx_payment_member ON payment(memberId);
CREATE INDEX IF NOT EXISTS idx_dispute_status ON dispute(status);
CREATE INDEX IF NOT EXISTS idx_deal_society ON deal(societyId, status);
CREATE INDEX IF NOT EXISTS idx_member_deal ON deal_member(dealId, status);
CREATE INDEX IF NOT EXISTS idx_member_user ON deal_member(userId);
`;

declare global {
  // eslint-disable-next-line no-var
  var __jodoDb: DatabaseSync | undefined;
}

/** Columns added after the first release, so an existing .data/jodo.db keeps working. */
const MIGRATIONS: [table: string, column: string, ddl: string][] = [
  ["gate_pass", "revokedAt", "ALTER TABLE gate_pass ADD COLUMN revokedAt TEXT"],
  ["gate_visit", "cancelledAt", "ALTER TABLE gate_visit ADD COLUMN cancelledAt TEXT"],
  ["gate_visit", "cancelledBy", "ALTER TABLE gate_visit ADD COLUMN cancelledBy TEXT REFERENCES user(id)"],
  ["guard_assignment", "isActive", "ALTER TABLE guard_assignment ADD COLUMN isActive INTEGER NOT NULL DEFAULT 1"],
  ["deal", "floorPricePaise", "ALTER TABLE deal ADD COLUMN floorPricePaise INTEGER"],
  ["sku", "ladderBasis", "ALTER TABLE sku ADD COLUMN ladderBasis TEXT NOT NULL DEFAULT 'flats'"],
  ["session", "expiresAt", "ALTER TABLE session ADD COLUMN expiresAt TEXT"],
  ["deal", "extendedAt", "ALTER TABLE deal ADD COLUMN extendedAt TEXT"],
  ["sku", "unitsPerSlot", "ALTER TABLE sku ADD COLUMN unitsPerSlot INTEGER NOT NULL DEFAULT 8"],
  ["sku", "repeatMonths", "ALTER TABLE sku ADD COLUMN repeatMonths INTEGER NOT NULL DEFAULT 0"],
  ["user", "lang", "ALTER TABLE user ADD COLUMN lang TEXT NOT NULL DEFAULT 'en'"],
  ["vendor", "skuIds", "ALTER TABLE vendor ADD COLUMN skuIds TEXT NOT NULL DEFAULT '[]'"],
  ["notification", "gateVisitId", "ALTER TABLE notification ADD COLUMN gateVisitId TEXT"],
  ["notification", "residencyId", "ALTER TABLE notification ADD COLUMN residencyId TEXT"],
];

/** What each seeded vendor offers — also backfills a database created before skuIds existed. */
const VENDOR_SKUS: Record<string, string[]> = {
  ven_coolcare: ["sku_ac_service"],
  ven_frostline: ["sku_ac_service"],
  ven_sparkle: ["sku_deep_clean"],
  ven_tidynest: ["sku_deep_clean"],
  ven_shinewash: ["sku_car_wash"],
  ven_greenshield: ["sku_pest"],
};

function migrate(db: DatabaseSync) {
  for (const [table, column, ddl] of MIGRATIONS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) db.exec(ddl);
  }
  for (const [vendorId, skuIds] of Object.entries(VENDOR_SKUS)) {
    db.prepare("UPDATE vendor SET skuIds = ? WHERE id = ? AND skuIds = '[]'").run(JSON.stringify(skuIds), vendorId);
  }
}

function open(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(SQLITE_SCHEMA());
  migrate(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (usesPostgres() || process.env.VERCEL === "1") throw new Error("The SQLite connection is available only in local mode.");
  if (!globalThis.__jodoDb) {
    globalThis.__jodoDb = open();
    if (isDemoMode()) seedIfEmpty(globalThis.__jodoDb);
  }
  return globalThis.__jodoDb;
}

/** Used only by the hosted initializer, with no data in the resident schema. */
export function createSchemaDatabase(withDemoData = false) {
  const db = new DatabaseSync(":memory:");
  db.exec(SQLITE_SCHEMA());
  if (withDemoData) seed(db);
  return db;
}

type Transaction = { sqlite: DatabaseSync } | { postgres: PoolClient };
const context = new AsyncLocalStorage<Transaction>();
let sqliteQueue = Promise.resolve();
let postgresPool: Pool | undefined;

// PostgreSQL COUNT and SUM(integer) return bigint. The app uses safe integer counts and paise.
types.setTypeParser(20, (value) => {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new RangeError("Database integer is outside the app's safe range.");
  return result;
});

function pool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Set DATABASE_URL for the hosted PostgreSQL database.");
  return postgresPool ??= new Pool({ ...postgresConnection(connectionString), max: 2, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 10_000, allowExitOnIdle: true });
}

async function withSqlite<T>(work: (db: DatabaseSync) => T | Promise<T>): Promise<T> {
  const existing = context.getStore();
  if (existing && "sqlite" in existing) return work(existing.sqlite);
  const previous = sqliteQueue;
  let release!: () => void;
  sqliteQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return await work(getDb());
  } finally {
    release();
  }
}

async function withPostgres<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const existing = context.getStore();
  if (existing && "postgres" in existing) return work(existing.postgres);
  const client = await pool().connect();
  try {
    await client.query(`BEGIN; SET LOCAL search_path TO ${postgresSchema()}, pg_catalog`);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function pgValues(params: unknown[]) {
  return params.map((value) => value instanceof Uint8Array ? Buffer.from(value) : value);
}

export async function all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]> {
  if (usesPostgres() || process.env.VERCEL === "1") {
    return withPostgres(async (client) => (await client.query(postgresSql(sql), pgValues(params))).rows as T[]);
  }
  // SQLite returns null-prototype objects which React Server Components cannot serialize.
  return withSqlite((db) => (db.prepare(sql).all(...(params as never[])) as T[]).map((row) => ({ ...row })));
}

export async function one<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | null> {
  if (usesPostgres() || process.env.VERCEL === "1") return (await all<T>(sql, ...params))[0] ?? null;
  return withSqlite((db) => {
    const row = db.prepare(sql).get(...(params as never[])) as T | undefined;
    return row ? { ...row } : null;
  });
}

export async function run(sql: string, ...params: unknown[]): Promise<{ changes: number }> {
  if (usesPostgres() || process.env.VERCEL === "1") {
    return withPostgres(async (client) => ({ changes: (await client.query(postgresSql(sql), pgValues(params))).rowCount ?? 0 }));
  }
  return withSqlite((db) => ({ changes: Number(db.prepare(sql).run(...(params as never[])).changes) }));
}

export async function inTransaction<T>(work: () => Promise<T> | T): Promise<T> {
  if (context.getStore()) throw new Error("Nested database transactions are unsupported.");
  if (usesPostgres() || process.env.VERCEL === "1") {
    return withPostgres(async (client) => {
      // Match the serialized writers of SQLite's BEGIN IMMEDIATE for all app workflows.
      await client.query("SELECT pg_advisory_xact_lock(110415234, 1)");
      return context.run({ postgres: client }, work);
    });
  }
  return withSqlite(async (db) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = await context.run({ sqlite: db }, work);
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });
}

export function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function newRevisitCodes(originalStart: string, originalEnd: string) {
  const used = new Set([originalStart, originalEnd]);
  function nextCode() {
    let code = String(randomInt(1000, 10_000));
    while (used.has(code)) code = String(randomInt(1000, 10_000));
    used.add(code);
    return code;
  }
  return [nextCode(), nextCode()] as const;
}

// ---------------------------------------------------------------- seed data

/** The sample bookings predate the visit and payment records. */
function backfillDemoBookings(db: DatabaseSync) {
  db.exec(`
    INSERT INTO job (id, dealId, memberId, flat, technician, slot, status, startOtp, endOtp, startedAt, finishedAt)
    SELECT 'job_' || lower(hex(randomblob(8))), d.id, m.id, m.flat,
           CASE d.id WHEN 'deal_carwash' THEN 'ShineWash crew' ELSE 'CoolCare crew' END,
           m.slot, CASE m.status WHEN 'served' THEN 'completed' ELSE 'scheduled' END,
           1000 + abs(random() % 9000), 1000 + abs(random() % 9000),
           CASE m.status WHEN 'served' THEN d.serviceDate END,
           CASE m.status WHEN 'served' THEN d.serviceDate END
    FROM deal_member m JOIN deal d ON d.id = m.dealId
    WHERE ((d.id = 'deal_carwash' AND d.status IN ('locked', 'in_progress') AND m.status = 'locked')
           OR (d.id = 'deal_ac_done' AND d.status = 'completed' AND m.status = 'served'))
      AND NOT EXISTS (SELECT 1 FROM job j WHERE j.memberId = m.id);

    UPDATE job SET status = 'en_route'
    WHERE dealId = 'deal_carwash' AND status = 'scheduled'
      AND EXISTS (SELECT 1 FROM deal d WHERE d.id = 'deal_carwash' AND d.status = 'in_progress')
      AND NOT EXISTS (SELECT 1 FROM job j WHERE j.dealId = 'deal_carwash' AND j.status IN ('en_route', 'in_progress'))
      AND slot = (SELECT min(j.slot) FROM job j WHERE j.dealId = 'deal_carwash' AND j.status = 'scheduled');

    INSERT INTO payment (id, memberId, dealId, type, method, amountPaise, status, ref, createdAt)
    SELECT 'pay_seed_' || m.id, m.id, d.id, 'capture', m.paymentMethod, m.finalPricePaise * m.units,
           'captured', 'sim_seed_' || m.id, coalesce(d.lockedAt, d.createdAt)
    FROM deal_member m JOIN deal d ON d.id = m.dealId
    WHERE d.id IN ('deal_carwash', 'deal_ac_done') AND d.status IN ('locked', 'in_progress', 'completed')
      AND m.status IN ('locked', 'served') AND m.finalPricePaise IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM payment p WHERE p.memberId = m.id AND p.type = 'capture');
  `);
}

const DAY = 86_400_000;

function nextWeekday(target: number, weeksAhead = 0) {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  const delta = (target - d.getDay() + 7) % 7 || 7;
  return new Date(d.getTime() + (delta + weeksAhead * 7) * DAY);
}

const NEIGHBOURS: [string, string][] = [
  ["Amit Kulkarni", "A-402"], ["Sneha Pillai", "A-101"], ["Rajesh Nair", "A-304"],
  ["Farah Shaikh", "B-201"], ["Vikram Rao", "B-505"], ["Meera Joshi", "C-103"],
  ["Imran Qureshi", "C-702"], ["Deepa Iyer", "A-205"], ["Sandeep Bose", "B-309"],
  ["Nisha Verma", "C-406"], ["Karan Gill", "A-601"], ["Pooja Deshmukh", "B-104"],
  ["Arun Menon", "C-208"], ["Tanvi Shah", "A-503"], ["Gaurav Sinha", "B-706"],
  ["Ritu Agarwal", "C-301"], ["Mohit Bansal", "A-107"], ["Shweta Rane", "B-402"],
  ["Harish Patel", "C-605"], ["Ananya Dutta", "A-308"], ["Zoya Khan", "B-603"],
  ["Prakash Jadhav", "C-104"], ["Leena Thomas", "A-704"], ["Siddharth Roy", "B-208"],
];

/**
 * Wipes every row and seeds again. The seed is written relative to "now", so a
 * demo database a few days old shows every group as closed — this puts it back.
 */
export function resetAllData() {
  const db = getDb();
  const tables = [
    "gate_visit", "gate_pass", "guard_assignment",
    "society_complaint_event", "society_complaint",
    "society_amenity_reservation", "society_amenity",
    "society_poll_vote", "society_poll_option", "society_poll",
    "society_meeting_rsvp", "society_meeting", "society_notice",
    "society_finance_payments", "society_finance_bill_items", "society_finance_bills", "society_finance_expense_receipts", "society_finance_expenses",
    "society_finance_bank_balances",
    "analytics_event", "notification", "payment", "revisit", "dispute", "job", "deal_event", "comment",
    "deal_member", "deal", "google_link", "google_identity", "email_link", "email_identity", "residency", "user", "sku", "vendor", "society",
  ];
  // Sessions are kept: the seeded accounts come back with the same ids, so whoever
  // pressed reset stays signed in.
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const t of tables) db.exec(`DELETE FROM ${t}`);
    seed(db);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function seedIfEmpty(db: DatabaseSync) {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM society").get() as { n: number };
  if (existing.n === 0) {
    seed(db);
    return;
  }
  backfillDemoBookings(db);
  backfillRevisitApprovals(db);
  seedDemoGuard(db);
}

function seedDemoGuard(db: DatabaseSync) {
  db.exec(`
    INSERT OR IGNORE INTO user (id, phone, name, role)
    SELECT 'usr_guard_green', '9000000098', 'Green Valley Gate', 'guard'
    WHERE EXISTS (SELECT 1 FROM society WHERE id = 'soc_green_valley');

    INSERT OR IGNORE INTO guard_assignment (userId, societyId)
    SELECT u.id, s.id FROM user u CROSS JOIN society s
    WHERE u.id = 'usr_guard_green' AND u.role = 'guard' AND s.id = 'soc_green_valley';
  `);
}

/** Older approvals had no appointment. Recover the latest approval per original visit. */
function backfillRevisitApprovals(db: DatabaseSync) {
  const approvals = db.prepare(`
    WITH ranked AS (
      SELECT d.id AS disputeId, coalesce(d.resolvedAt, d.createdAt) AS approvedAt, j.startOtp, j.endOtp,
             row_number() OVER (PARTITION BY d.jobId ORDER BY coalesce(d.resolvedAt, d.createdAt) DESC, d.id DESC) AS rank
      FROM dispute d JOIN job j ON j.id = d.jobId
      WHERE d.status = 'resolved' AND d.resolution LIKE 'revisit:%' AND j.status = 'completed'
    )
    SELECT disputeId, approvedAt, startOtp, endOtp FROM ranked
    WHERE rank = 1 AND NOT EXISTS (SELECT 1 FROM revisit r WHERE r.disputeId = ranked.disputeId)
  `).all() as { disputeId: string; approvedAt: string; startOtp: string; endOtp: string }[];
  const insert = db.prepare(`
    INSERT INTO revisit (id, disputeId, startOtp, endOtp, createdAt) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(disputeId) DO NOTHING
  `);
  for (const approval of approvals) {
    const codes = newRevisitCodes(approval.startOtp, approval.endOtp);
    insert.run(`visit_${approval.disputeId}`, approval.disputeId, ...codes, approval.approvedAt);
  }
}

export function seed(db: DatabaseSync) {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();

  const soc = { id: "soc_green_valley", name: "Green Valley Society", locality: "Wakad", city: "Pune", flatCount: 212 };
  db.prepare("INSERT INTO society (id,name,locality,city,flatCount,approvalRequired) VALUES (?,?,?,?,?,0)")
    .run(soc.id, soc.name, soc.locality, soc.city, soc.flatCount);
  db.prepare("INSERT INTO society (id,name,locality,city,flatCount,approvalRequired) VALUES (?,?,?,?,?,1)")
    .run("soc_palm_grove", "Palm Grove Residency", "Hinjewadi", "Pune", 164);

  const vendors = [
    ["ven_coolcare", "CoolCare AC Services", 4.8, 412, ["Verified", "Society-approved", "Assured"]],
    ["ven_frostline", "FrostLine Aircon", 4.6, 238, ["Verified"]],
    ["ven_sparkle", "SparkleHome Deep Cleaning", 4.7, 286, ["Verified", "Assured"]],
    ["ven_tidynest", "TidyNest Home Services", 4.4, 131, ["Verified"]],
    ["ven_shinewash", "ShineWash Auto Care", 4.6, 1890, ["Verified", "Society-approved"]],
    ["ven_greenshield", "GreenShield Pest Control", 4.5, 173, ["Verified", "Assured"]],
  ] as const;
  for (const [vid, name, rating, jobs, badges] of vendors) {
    db.prepare("INSERT INTO vendor (id,name,rating,jobsDone,badges,city,skuIds) VALUES (?,?,?,?,?,?,?)")
      .run(vid, name, rating, jobs, JSON.stringify(badges), "Pune", JSON.stringify(VENDOR_SKUS[vid] ?? []));
  }

  const skus = [
    {
      id: "sku_ac_service", category: "Appliance care", name: "AC service & deep clean",
      unit: "ac", unitLabel: "AC unit", listPricePaise: 99900, durationMin: 45,
      included: ["Jet-spray coil & filter clean", "Gas pressure check", "Drain line flush", "Full function test"],
      excluded: ["Gas refill (quoted separately)", "PCB / compressor replacement", "Uninstall & reinstall"],
      warrantyDays: 30, mvsDefault: 10, season: "Feb–May", ladderBasis: "units", unitsPerSlot: 10, repeatMonths: 6,
      defaultSlabs: [{ minFlats: 5, pricePaise: 84900 }, { minFlats: 10, pricePaise: 74900 }, { minFlats: 20, pricePaise: 64500 }, { minFlats: 35, pricePaise: 59900 }],
    },
    {
      id: "sku_deep_clean", category: "Home cleaning", name: "Pre-Diwali deep cleaning (2BHK)",
      unit: "flat", unitLabel: "flat", listPricePaise: 199900, durationMin: 240,
      included: ["Full flat dusting & scrubbing", "Kitchen degrease", "2 bathrooms deep clean", "Balcony & window glass"],
      excluded: ["Sofa / carpet shampoo (add-on)", "Exterior window faces", "Furniture moving above 40 kg"],
      warrantyDays: 7, mvsDefault: 10, season: "Sep–Nov", ladderBasis: "flats", unitsPerSlot: 3, repeatMonths: 12,
      defaultSlabs: [{ minFlats: 5, pricePaise: 174900 }, { minFlats: 10, pricePaise: 149900 }, { minFlats: 20, pricePaise: 139900 }],
    },
    {
      id: "sku_car_wash", category: "Car care", name: "Monthly car wash (4 washes)",
      unit: "car", unitLabel: "car", listPricePaise: 250000, durationMin: 40,
      included: ["4 foam washes at your parking", "Interior vacuum", "Tyre polish", "Dashboard wipe-down"],
      excluded: ["Rubbing & polishing", "Engine bay wash", "Ceramic coating"],
      warrantyDays: 0, mvsDefault: 15, season: "All year", ladderBasis: "units", unitsPerSlot: 12, repeatMonths: 1,
      defaultSlabs: [{ minFlats: 10, pricePaise: 190000 }, { minFlats: 25, pricePaise: 150000 }, { minFlats: 50, pricePaise: 125000 }],
    },
    {
      id: "sku_pest", category: "Pest control", name: "Cockroach & ant treatment",
      unit: "flat", unitLabel: "flat", listPricePaise: 149900, durationMin: 60,
      included: ["Gel + spray treatment", "Kitchen & bathroom focus", "Child/pet-safe chemicals", "One free follow-up"],
      excluded: ["Termite treatment", "Bed-bug treatment", "Fumigation"],
      warrantyDays: 45, mvsDefault: 8, season: "Jun–Sep", ladderBasis: "flats", unitsPerSlot: 8, repeatMonths: 6,
      defaultSlabs: [{ minFlats: 5, pricePaise: 129900 }, { minFlats: 10, pricePaise: 109900 }, { minFlats: 20, pricePaise: 99900 }],
    },
  ];
  for (const s of skus) {
    db.prepare(`INSERT INTO sku (id,category,name,unit,unitLabel,listPricePaise,durationMin,included,excluded,warrantyDays,mvsDefault,season,defaultSlabs,ladderBasis,unitsPerSlot,repeatMonths)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      s.id, s.category, s.name, s.unit, s.unitLabel, s.listPricePaise, s.durationMin,
      JSON.stringify(s.included), JSON.stringify(s.excluded), s.warrantyDays, s.mvsDefault, s.season,
      JSON.stringify(s.defaultSlabs), s.ladderBasis, s.unitsPerSlot, s.repeatMonths,
    );
  }

  // users ------------------------------------------------------------------
  const mkUser = (uid: string, phone: string, name: string, role = "resident", vendorId: string | null = null) => {
    db.prepare("INSERT INTO user (id,phone,name,role,vendorId) VALUES (?,?,?,?,?)").run(uid, phone, name, role, vendorId);
    return uid;
  };
  const mkResidency = (uid: string, flat: string, status = "verified") => {
    db.prepare("INSERT INTO residency (id,userId,societyId,flat,type,status,verifiedVia,createdAt) VALUES (?,?,?,?,?,?,?,?)")
      .run(id("res"), uid, soc.id, flat, "owner", status, "ops", iso(now));
  };

  const rahul = mkUser("usr_rahul", "9000000001", "Rahul Mehta");
  mkResidency(rahul, "A-402");
  const secretary = mkUser("usr_kulkarni", "9000000002", "Amit Kulkarni", "secretary");
  mkResidency(secretary, "A-404");
  mkUser("usr_vendor_cool", "9000000010", "Suresh Yadav (CoolCare)", "vendor", "ven_coolcare");
  mkUser("usr_vendor_sparkle", "9000000011", "Reena Das (SparkleHome)", "vendor", "ven_sparkle");
  mkUser("usr_ops", "9000000099", "JODO Ops", "ops");

  const neighbourIds: { uid: string; flat: string }[] = [];
  NEIGHBOURS.forEach(([name, flat], i) => {
    if (flat === "A-402" || flat === "A-404") return;
    const uid = mkUser(`usr_n${i}`, `90000001${String(i).padStart(2, "0")}`, name);
    mkResidency(uid, flat);
    neighbourIds.push({ uid, flat });
  });

  // deals ------------------------------------------------------------------
  const mkDeal = (d: {
    id: string; skuId: string; vendorId: string; createdBy: string; serviceDate: Date;
    status: string; deadline: Date; target: number; mvs: number; lockedAt?: Date;
  }) => {
    const sku = skus.find((s) => s.id === d.skuId)!;
    db.prepare(`INSERT INTO deal (id,societyId,skuId,vendorId,createdBy,serviceDate,slotWindows,status,joinDeadline,targetFlats,mvs,listPricePaise,slabs,createdAt,lockedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      d.id, soc.id, d.skuId, d.vendorId, d.createdBy, iso(d.serviceDate),
      JSON.stringify(["08:00–10:00", "10:00–12:00", "12:00–14:00", "16:00–18:00"]),
      d.status, iso(d.deadline), d.target, d.mvs, sku.listPricePaise,
      JSON.stringify(sku.defaultSlabs), iso(new Date(now.getTime() - 2 * DAY)),
      d.lockedAt ? iso(d.lockedAt) : null,
    );
  };

  const joinMany = (dealId: string, count: number, status = "joined", slotIdx = 1) => {
    const slots = ["08:00–10:00", "10:00–12:00", "12:00–14:00", "16:00–18:00"];
    neighbourIds.slice(0, count).forEach((n, i) => {
      db.prepare(`INSERT INTO deal_member (id,dealId,userId,flat,units,slot,paymentMethod,status,finalPricePaise,joinedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        id("dm"), dealId, n.uid, n.flat, 1, slots[(i + slotIdx) % slots.length], "upi", status, null,
        iso(new Date(now.getTime() - (count - i) * 3_600_000)),
      );
    });
  };

  const sunday = nextWeekday(0);
  // 1. The reel's deal: AC service this Sunday, filling.
  mkDeal({ id: "deal_ac_sunday", skuId: "sku_ac_service", vendorId: "ven_coolcare", createdBy: secretary, serviceDate: sunday, status: "open", deadline: new Date(now.getTime() + 2 * DAY + 4 * 3_600_000), target: 20, mvs: 10 });
  joinMany("deal_ac_sunday", 12);
  db.prepare("INSERT INTO comment (id,dealId,userId,body,createdAt) VALUES (?,?,?,?,?)")
    .run(id("cmt"), "deal_ac_sunday", secretary, "I am in. Posting this in the society WhatsApp group too.", iso(new Date(now.getTime() - 5 * 3_600_000)));
  db.prepare("INSERT INTO comment (id,dealId,userId,body,createdAt) VALUES (?,?,?,?,?)")
    .run(id("cmt"), "deal_ac_sunday", neighbourIds[2].uid, "Do they clean the outdoor unit also?", iso(new Date(now.getTime() - 3 * 3_600_000)));

  // 2. Almost there: 8/10 for pre-Diwali deep cleaning.
  mkDeal({ id: "deal_deepclean", skuId: "sku_deep_clean", vendorId: "ven_sparkle", createdBy: rahul, serviceDate: nextWeekday(6), status: "open", deadline: new Date(now.getTime() + 18 * 3_600_000), target: 10, mvs: 10 });
  joinMany("deal_deepclean", 8, "joined", 2);

  // 3. Locked: monthly car wash, 20 cars, confirmed.
  mkDeal({ id: "deal_carwash", skuId: "sku_car_wash", vendorId: "ven_shinewash", createdBy: secretary, serviceDate: nextWeekday(0, 1), status: "locked", deadline: new Date(now.getTime() - 2 * 3_600_000), target: 25, mvs: 15, lockedAt: new Date(now.getTime() - 2 * 3_600_000) });
  joinMany("deal_carwash", 20, "locked", 0);
  db.prepare("UPDATE deal_member SET finalPricePaise = 190000 WHERE dealId = 'deal_carwash'").run();

  // 4. Expired: pest control never reached 8 flats.
  mkDeal({ id: "deal_pest", skuId: "sku_pest", vendorId: "ven_greenshield", createdBy: rahul, serviceDate: new Date(now.getTime() - 1 * DAY), status: "expired", deadline: new Date(now.getTime() - 3 * DAY), target: 10, mvs: 8 });
  joinMany("deal_pest", 4, "joined", 3);

  // 5. Completed last month: AC service, for history + ratings.
  mkDeal({ id: "deal_ac_done", skuId: "sku_ac_service", vendorId: "ven_coolcare", createdBy: secretary, serviceDate: new Date(now.getTime() - 32 * DAY), status: "completed", deadline: new Date(now.getTime() - 34 * DAY), target: 20, mvs: 10, lockedAt: new Date(now.getTime() - 34 * DAY) });
  joinMany("deal_ac_done", 18, "served", 0);
  db.prepare("UPDATE deal_member SET finalPricePaise = 74900 WHERE dealId = 'deal_ac_done'").run();
  backfillDemoBookings(db);

  db.prepare("INSERT INTO deal_event (dealId,type,payload,createdAt) VALUES (?,?,?,?)")
    .run("deal_ac_sunday", "created", JSON.stringify({ by: "seed" }), iso(now));
  seedDemoGuard(db);
}
