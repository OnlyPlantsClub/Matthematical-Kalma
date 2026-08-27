-- Establish a harmless schema anchor so the migration toolchain can be
-- validated before identity or personal-data tables are implemented.
PRAGMA foreign_keys = ON;

CREATE TABLE platform_schema_metadata (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  schema_contract_version INTEGER NOT NULL CHECK (schema_contract_version > 0),
  established_at TEXT NOT NULL
    CHECK (established_at GLOB '????-??-??T??:??:??.???Z')
);

INSERT INTO platform_schema_metadata (
  singleton_id,
  schema_contract_version,
  established_at
) VALUES (1, 1, '2026-08-27T00:00:00.000Z');
