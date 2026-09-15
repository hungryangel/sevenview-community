CREATE TABLE daily_counts (
  day TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('landing_visit', 'app_use', 'export_complete')),
  count INTEGER NOT NULL CHECK (count > 0),
  PRIMARY KEY (day, event),
  CHECK (day = strftime('%Y-%m-%d', day))
) WITHOUT ROWID;
