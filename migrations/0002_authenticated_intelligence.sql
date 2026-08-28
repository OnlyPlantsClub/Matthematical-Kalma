PRAGMA foreign_keys = ON;

UPDATE platform_schema_metadata SET schema_contract_version = 2 WHERE singleton_id = 1 AND schema_contract_version = 1;

CREATE TABLE intelligence_rights_schedules (
  environment_id TEXT NOT NULL, schedule_id TEXT NOT NULL, contract_version TEXT NOT NULL CHECK (contract_version = 'intelligence-retention/1'),
  source_class TEXT NOT NULL CHECK (source_class IN ('synthetic_project_owned','manual_user_owned')), schedule_jcs TEXT NOT NULL CHECK (length(schedule_jcs) <= 8192),
  created_at TEXT NOT NULL CHECK (created_at GLOB '????-??-??T??:??:??.???Z'), PRIMARY KEY (environment_id, schedule_id)
);
CREATE TABLE intelligence_key_metadata (
  environment_id TEXT NOT NULL, key_id TEXT NOT NULL, algorithm TEXT NOT NULL CHECK (algorithm = 'HMAC-SHA-256'),
  status TEXT NOT NULL CHECK (status IN ('active','verify-only','revoked','unavailable')), activates_at TEXT NOT NULL,
  verify_until TEXT, PRIMARY KEY (environment_id,key_id)
);
CREATE UNIQUE INDEX one_active_intelligence_key_per_environment ON intelligence_key_metadata(environment_id) WHERE status='active';

CREATE TABLE authenticated_intelligence_records (
  environment_id TEXT NOT NULL, record_id TEXT NOT NULL, stream_id TEXT NOT NULL, record_type TEXT NOT NULL CHECK (record_type IN ('market_observation','canonical_result_observation')),
  schema_version TEXT NOT NULL CHECK (schema_version='mk-intelligence-record-jcs/1'), contract_version TEXT NOT NULL CHECK (contract_version='authenticated-intelligence-record/1'),
  rights_schedule_id TEXT NOT NULL, key_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, content_hash TEXT NOT NULL, authentication_tag TEXT NOT NULL,
  header_jcs TEXT NOT NULL CHECK(length(header_jcs)<=8192), payload_jcs TEXT NOT NULL CHECK(length(payload_jcs)<=49152), parent_head_id TEXT,
  corrects_record_id TEXT, issued_at TEXT NOT NULL, validated_at TEXT NOT NULL, delete_after TEXT, indefinite_basis TEXT,
  PRIMARY KEY(environment_id,record_id), UNIQUE(environment_id,idempotency_key), UNIQUE(environment_id,content_hash,record_type),
  FOREIGN KEY(environment_id,rights_schedule_id) REFERENCES intelligence_rights_schedules(environment_id,schedule_id),
  FOREIGN KEY(environment_id,key_id) REFERENCES intelligence_key_metadata(environment_id,key_id),
  FOREIGN KEY(environment_id,parent_head_id) REFERENCES authenticated_intelligence_records(environment_id,record_id),
  FOREIGN KEY(environment_id,corrects_record_id) REFERENCES authenticated_intelligence_records(environment_id,record_id),
  CHECK ((delete_after IS NULL) <> (indefinite_basis IS NULL)), CHECK(corrects_record_id IS NULL OR corrects_record_id=parent_head_id)
);
CREATE TABLE intelligence_record_parents (
  environment_id TEXT NOT NULL, child_record_id TEXT NOT NULL, parent_record_id TEXT NOT NULL, ordinal INTEGER NOT NULL CHECK(ordinal BETWEEN 0 AND 15),
  PRIMARY KEY(environment_id,child_record_id,parent_record_id), UNIQUE(environment_id,child_record_id,ordinal),
  FOREIGN KEY(environment_id,child_record_id) REFERENCES authenticated_intelligence_records(environment_id,record_id) ON DELETE CASCADE,
  FOREIGN KEY(environment_id,parent_record_id) REFERENCES authenticated_intelligence_records(environment_id,record_id)
);
CREATE UNIQUE INDEX intelligence_single_successor ON intelligence_record_parents(environment_id,parent_record_id) WHERE ordinal=0;
CREATE TABLE intelligence_stream_heads (
  environment_id TEXT NOT NULL, stream_id TEXT NOT NULL, record_type TEXT NOT NULL, current_record_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0),
  PRIMARY KEY(environment_id,stream_id), FOREIGN KEY(environment_id,current_record_id) REFERENCES authenticated_intelligence_records(environment_id,record_id)
);
CREATE TABLE intelligence_retention_dispositions (
  environment_id TEXT NOT NULL, record_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('retained','delete_required','deleted')),
  delete_after TEXT, indefinite_basis TEXT, legal_hold INTEGER NOT NULL CHECK(legal_hold IN (0,1)), planned_at TEXT NOT NULL,
  PRIMARY KEY(environment_id,record_id), FOREIGN KEY(environment_id,record_id) REFERENCES authenticated_intelligence_records(environment_id,record_id) ON DELETE CASCADE
);
CREATE TABLE intelligence_quarantine_records (
  environment_id TEXT NOT NULL, quarantine_id TEXT NOT NULL, record_id TEXT, reason TEXT NOT NULL,
  metadata_jcs TEXT NOT NULL CHECK(length(metadata_jcs)<=2048), created_at TEXT NOT NULL, PRIMARY KEY(environment_id,quarantine_id)
);
CREATE TABLE intelligence_audit_events (
  environment_id TEXT NOT NULL, event_id TEXT NOT NULL, event_type TEXT NOT NULL CHECK(event_type IN ('record_appended','record_rehydrated','record_quarantined','deletion_planned','restore_reconciled')),
  record_id TEXT, occurred_at TEXT NOT NULL, metadata_jcs TEXT NOT NULL CHECK(length(metadata_jcs)<=2048), PRIMARY KEY(environment_id,event_id)
);

CREATE TRIGGER intelligence_record_head_guard BEFORE INSERT ON authenticated_intelligence_records BEGIN
  SELECT CASE
    WHEN NEW.parent_head_id IS NULL AND EXISTS(SELECT 1 FROM intelligence_stream_heads WHERE environment_id=NEW.environment_id AND stream_id=NEW.stream_id) THEN RAISE(ABORT,'intelligence_head_conflict')
    WHEN NEW.parent_head_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM intelligence_stream_heads WHERE environment_id=NEW.environment_id AND stream_id=NEW.stream_id AND record_type=NEW.record_type AND current_record_id=NEW.parent_head_id) THEN RAISE(ABORT,'intelligence_head_conflict')
  END;
END;

CREATE TRIGGER intelligence_record_stream_scope BEFORE INSERT ON authenticated_intelligence_records WHEN NEW.parent_head_id IS NOT NULL BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM authenticated_intelligence_records p WHERE p.environment_id=NEW.environment_id AND p.record_id=NEW.parent_head_id AND p.stream_id=NEW.stream_id AND p.record_type=NEW.record_type) THEN RAISE(ABORT,'intelligence_parent_scope_conflict') END;
END;

CREATE TRIGGER intelligence_parent_edge_scope BEFORE INSERT ON intelligence_record_parents BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM authenticated_intelligence_records child
    JOIN authenticated_intelligence_records parent ON parent.environment_id=child.environment_id
      AND parent.record_id=NEW.parent_record_id AND parent.stream_id=child.stream_id AND parent.record_type=child.record_type
    WHERE child.environment_id=NEW.environment_id AND child.record_id=NEW.child_record_id
  ) THEN RAISE(ABORT,'intelligence_parent_scope_conflict') END;
END;
