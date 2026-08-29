import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration=await readFile(new URL('../migrations/0002_authenticated_intelligence.sql',import.meta.url),'utf8');
const sources=await Promise.all(['authenticated-record.ts','canonical-json.ts','intelligence-rights.ts','intelligence-repository.ts','intelligence-governance.ts'].map((name)=>readFile(new URL(`../src/domain/intelligence/${name}`,import.meta.url),'utf8')));
const joined=sources.join('\n');

test('migration is forward-only, scoped and makes runtime deletion impossible',()=>{
 assert.match(migration,/schema_contract_version=2/);assert.match(migration,/PRAGMA foreign_keys=ON/);
 for(const table of ['intelligence_rights_schedules','authenticated_intelligence_records','intelligence_record_parents','intelligence_record_commits','intelligence_stream_heads','intelligence_quarantine_records','intelligence_audit_events','intelligence_retention_events','intelligence_keys','intelligence_key_status_events','intelligence_key_rotations','intelligence_head_transitions','intelligence_finalization_receipts','governed_deletion_authorizations'])assert.match(migration,new RegExp(`CREATE TABLE ${table}`));
 assert.doesNotMatch(migration,/DROP TABLE|DROP COLUMN/);assert.doesNotMatch(migration,/bankroll|wager|stake|provider_payload/i);assert.match(migration,/protected_intelligence_history/);assert.match(migration,/immutable_intelligence_history/);
 assert.match(migration,/UNIQUE\(environment_id,idempotency_key\)/);assert.match(migration,/multiple_active_keys/);assert.match(migration,/key_rotation_finalization_failed/);assert.match(migration,/no_update_intelligence_quarantine/);assert.match(migration,/no_delete_intelligence_quarantine/);assert.match(migration,/head_finalization_failed/);assert.doesNotMatch(migration,/WHEN NOT EXISTS\(SELECT 1 FROM governed_deletion_authorizations/);
});

test('operational slice contains no network/provider acquisition, binding changes or real secret',()=>{
 assert.doesNotMatch(joined,/\bfetch\s*\(|process\.env|CLOUDFLARE_API_TOKEN|sk-[A-Za-z0-9]|BEGIN PRIVATE KEY/);
 assert.doesNotMatch(joined,/\bfetch\s*\(|scrap(e|ing)|kelly|wager|bankroll/i);
 assert.match(joined,/ExternalDeletionLedger/);assert.match(joined,/PostRestoreReconciliationPort/);assert.match(joined,/maxQuarantineMetadataBytes/);
});
