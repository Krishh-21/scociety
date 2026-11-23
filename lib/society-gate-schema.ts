export const SOCIETY_GATE_SCHEMA = `
CREATE TABLE IF NOT EXISTS gate_pass (
  id TEXT PRIMARY KEY,
  societyId TEXT NOT NULL REFERENCES society(id),
  residencyId TEXT NOT NULL,
  residentId TEXT NOT NULL REFERENCES user(id),
  flat TEXT NOT NULL,
  guestName TEXT NOT NULL,
  codeHash TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  usedAt TEXT,
  UNIQUE (societyId, codeHash)
);

CREATE TABLE IF NOT EXISTS gate_visit (
  id TEXT PRIMARY KEY,
  societyId TEXT NOT NULL REFERENCES society(id),
  residencyId TEXT NOT NULL,
  residentId TEXT NOT NULL REFERENCES user(id),
  flat TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('guest', 'delivery', 'help')),
  visitorName TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied', 'checked_in', 'checked_out')),
  passId TEXT UNIQUE REFERENCES gate_pass(id),
  loggedBy TEXT NOT NULL REFERENCES user(id),
  createdAt TEXT NOT NULL,
  decidedBy TEXT REFERENCES user(id),
  decidedAt TEXT,
  checkedInBy TEXT REFERENCES user(id),
  checkedInAt TEXT,
  checkedOutBy TEXT REFERENCES user(id),
  checkedOutAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_gate_visit_society ON gate_visit(societyId, createdAt);
CREATE INDEX IF NOT EXISTS idx_gate_visit_checkin ON gate_visit(societyId, checkedInAt);
CREATE INDEX IF NOT EXISTS idx_gate_visit_residency ON gate_visit(residencyId, createdAt);
CREATE INDEX IF NOT EXISTS idx_gate_pass_residency ON gate_pass(residencyId, createdAt);
`;
