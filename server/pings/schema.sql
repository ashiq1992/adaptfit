-- One row per device per UTC day. The primary key de-duplicates repeat pings.
-- No IP address, names or workout data are stored.
CREATE TABLE IF NOT EXISTS pings (
  id TEXT NOT NULL,          -- random install ID made on the phone (32 hex chars)
  day TEXT NOT NULL,         -- UTC date the server received the ping, YYYY-MM-DD
  v TEXT NOT NULL,           -- app version, e.g. 0.5.0
  installed INTEGER NOT NULL,-- 1 if opened from the Home Screen
  PRIMARY KEY (id, day)
);
CREATE INDEX IF NOT EXISTS pings_day ON pings(day);
