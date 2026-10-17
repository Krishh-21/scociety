import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = process.env.JODO_DB ?? path.join(DATA_DIR, "jodo.db");

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

CREATE TABLE IF NOT EXISTS vendor (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, rating REAL NOT NULL DEFAULT 4.5,
  jobsDone INTEGER NOT NULL DEFAULT 0, badges TEXT NOT NULL DEFAULT '[]', city TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS notification (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL, dealId TEXT, type TEXT NOT NULL,
  title TEXT NOT NULL, body TEXT NOT NULL, createdAt TEXT NOT NULL, readAt TEXT
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

CREATE TABLE IF NOT EXISTS analytics_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT, name TEXT NOT NULL,
  props TEXT NOT NULL DEFAULT '{}', createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_user ON notification(userId, readAt);
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
  ["deal", "floorPricePaise", "ALTER TABLE deal ADD COLUMN floorPricePaise INTEGER"],
  ["sku", "ladderBasis", "ALTER TABLE sku ADD COLUMN ladderBasis TEXT NOT NULL DEFAULT 'flats'"],
  ["session", "expiresAt", "ALTER TABLE session ADD COLUMN expiresAt TEXT"],
  ["deal", "extendedAt", "ALTER TABLE deal ADD COLUMN extendedAt TEXT"],
  ["sku", "unitsPerSlot", "ALTER TABLE sku ADD COLUMN unitsPerSlot INTEGER NOT NULL DEFAULT 8"],
  ["sku", "repeatMonths", "ALTER TABLE sku ADD COLUMN repeatMonths INTEGER NOT NULL DEFAULT 0"],
  ["user", "lang", "ALTER TABLE user ADD COLUMN lang TEXT NOT NULL DEFAULT 'en'"],
];

function migrate(db: DatabaseSync) {
  for (const [table, column, ddl] of MIGRATIONS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) db.exec(ddl);
  }
}

function open(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalThis.__jodoDb) {
    globalThis.__jodoDb = open();
    seedIfEmpty(globalThis.__jodoDb);
  }
  return globalThis.__jodoDb;
}

// node:sqlite hands back null-prototype objects; React Server Components refuse to
// serialise those, so every row is copied into a plain object on the way out.
export function all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  const rows = getDb().prepare(sql).all(...(params as never[])) as T[];
  return rows.map((r) => ({ ...r }));
}

export function one<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | null {
  const row = getDb().prepare(sql).get(...(params as never[])) as T | undefined;
  return row ? { ...row } : null;
}

export function run(sql: string, ...params: unknown[]) {
  return getDb().prepare(sql).run(...(params as never[]));
}

export function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------- seed data

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

export function seedIfEmpty(db: DatabaseSync) {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM society").get() as { n: number };
  if (existing.n > 0) return;
  seed(db);
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
    ["ven_sparkle", "SparkleHome Deep Cleaning", 4.7, 286, ["Verified", "Assured"]],
    ["ven_shinewash", "ShineWash Auto Care", 4.6, 1890, ["Verified", "Society-approved"]],
    ["ven_greenshield", "GreenShield Pest Control", 4.5, 173, ["Verified", "Assured"]],
  ] as const;
  for (const [vid, name, rating, jobs, badges] of vendors) {
    db.prepare("INSERT INTO vendor (id,name,rating,jobsDone,badges,city) VALUES (?,?,?,?,?,?)")
      .run(vid, name, rating, jobs, JSON.stringify(badges), "Pune");
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

  db.prepare("INSERT INTO deal_event (dealId,type,payload,createdAt) VALUES (?,?,?,?)")
    .run("deal_ac_sunday", "created", JSON.stringify({ by: "seed" }), iso(now));
}
