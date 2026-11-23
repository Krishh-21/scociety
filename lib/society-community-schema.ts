export const SOCIETY_COMMUNITY_SCHEMA = `
CREATE TABLE IF NOT EXISTS society_notice (
  id TEXT PRIMARY KEY, societyId TEXT NOT NULL REFERENCES society(id),
  authorId TEXT NOT NULL REFERENCES user(id), title TEXT NOT NULL, body TEXT NOT NULL,
  dealId TEXT REFERENCES deal(id) ON DELETE SET NULL,
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)), createdAt TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_society_notice_one_pinned
  ON society_notice(societyId) WHERE pinned = 1;
CREATE INDEX IF NOT EXISTS idx_society_notice_created ON society_notice(societyId, createdAt);

CREATE TABLE IF NOT EXISTS society_meeting (
  id TEXT PRIMARY KEY, societyId TEXT NOT NULL REFERENCES society(id),
  authorId TEXT NOT NULL REFERENCES user(id), title TEXT NOT NULL, agenda TEXT NOT NULL,
  location TEXT NOT NULL, startsAt TEXT NOT NULL, minutes TEXT, minutesPublishedAt TEXT,
  actualAttendance INTEGER CHECK (actualAttendance >= 0)
);

CREATE INDEX IF NOT EXISTS idx_society_meeting_start ON society_meeting(societyId, startsAt);

CREATE TABLE IF NOT EXISTS society_meeting_rsvp (
  meetingId TEXT NOT NULL REFERENCES society_meeting(id), userId TEXT NOT NULL REFERENCES user(id),
  response TEXT NOT NULL CHECK (response IN ('going', 'not_going')),
  PRIMARY KEY (meetingId, userId)
);

CREATE TABLE IF NOT EXISTS society_poll (
  id TEXT PRIMARY KEY, societyId TEXT NOT NULL REFERENCES society(id),
  authorId TEXT NOT NULL REFERENCES user(id), question TEXT NOT NULL,
  createdAt TEXT NOT NULL, closedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_society_poll_created ON society_poll(societyId, createdAt);

CREATE TABLE IF NOT EXISTS society_poll_option (
  id TEXT PRIMARY KEY, pollId TEXT NOT NULL REFERENCES society_poll(id),
  label TEXT NOT NULL, position INTEGER NOT NULL,
  UNIQUE (pollId, id), UNIQUE(pollId, position)
);

CREATE TABLE IF NOT EXISTS society_poll_vote (
  pollId TEXT NOT NULL, optionId TEXT NOT NULL, userId TEXT NOT NULL REFERENCES user(id),
  PRIMARY KEY (pollId, userId),
  FOREIGN KEY (pollId, optionId) REFERENCES society_poll_option(pollId, id)
);

CREATE INDEX IF NOT EXISTS idx_society_vote_option ON society_poll_vote(pollId, optionId);

CREATE TABLE IF NOT EXISTS society_amenity (
  id TEXT PRIMARY KEY, societyId TEXT NOT NULL REFERENCES society(id),
  name TEXT NOT NULL COLLATE NOCASE, description TEXT NOT NULL,
  UNIQUE (societyId, name)
);

CREATE TABLE IF NOT EXISTS society_amenity_reservation (
  id TEXT PRIMARY KEY, amenityId TEXT NOT NULL REFERENCES society_amenity(id),
  userId TEXT NOT NULL REFERENCES user(id), startsAt TEXT NOT NULL, endsAt TEXT NOT NULL,
  CHECK (endsAt > startsAt)
);

CREATE INDEX IF NOT EXISTS idx_society_reservation_start
  ON society_amenity_reservation(amenityId, startsAt, endsAt);

CREATE TRIGGER IF NOT EXISTS society_amenity_reservation_no_overlap
BEFORE INSERT ON society_amenity_reservation
WHEN EXISTS (
  SELECT 1 FROM society_amenity_reservation
  WHERE amenityId = NEW.amenityId AND startsAt < NEW.endsAt AND endsAt > NEW.startsAt
)
BEGIN
  SELECT RAISE(ABORT, 'amenity reservation overlaps');
END;
`;
