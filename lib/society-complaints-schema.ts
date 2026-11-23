export const SOCIETY_COMPLAINTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS society_complaint (
  id TEXT PRIMARY KEY,
  societyId TEXT NOT NULL REFERENCES society(id),
  userId TEXT NOT NULL REFERENCES user(id),
  flat TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','assigned','in_progress','resolved')),
  assignee TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS society_complaint_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  complaintId TEXT NOT NULL REFERENCES society_complaint(id),
  actorId TEXT NOT NULL REFERENCES user(id),
  status TEXT NOT NULL CHECK (status IN ('open','assigned','in_progress','resolved')),
  note TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_society_complaint_scope ON society_complaint(societyId, userId, status);
CREATE INDEX IF NOT EXISTS idx_society_complaint_event ON society_complaint_event(complaintId, id);
`;
