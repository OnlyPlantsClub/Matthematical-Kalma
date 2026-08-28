import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration=await readFile(new URL('../migrations/0002_authenticated_intelligence.sql',import.meta.url),'utf8');
const sources=await Promise.all(['authenticated-record.ts','canonical-json.ts','intelligence-rights.ts','intelligence-repository.ts','intelligence-governance.ts'].map((name)=>readFile(new URL(`../src/domain/intelligence/${name}`,import.meta.url),'utf8')));
const joined=sources.join('\n');

test('migration is forward-only, scoped and leaves governed deletion possible',()=>{
 assert.match(migration,/schema_contract_version=2/);assert.match(migration,/PRAGMA foreign_keys=ON/);
 for(const table of ['intelligence_rights_schedules','authenticated_intelligence_records','intelligence_record_parents','intelligence_record_commits','intelligence_stream_heads','intelligence_quarantine_records','intelligence_audit_events','intelligence_retention_events','intelligence_key_metadata','governed_deletion_authorizations'])assert.match(migration,new RegExp(`CREATE TABLE ${table}`));
 assert.doesNotMatch(migration,/DROP TABLE|DROP COLUMN/);assert.doesNotMatch(migration,/bankroll|wager|stake|provider_payload/i);assert.match(migration,/governed_deletion_required/);assert.match(migration,/immutable_intelligence_history/);
 assert.match(migration,/UNIQUE\(environment_id,idempotency_key\)/);assert.match(migration,/one_active_intelligence_key_per_environment/);assert.match(migration,/intelligence_single_successor/);
});

test('operational slice contains no network/provider acquisition, binding changes or real secret',()=>{
 assert.doesNotMatch(joined,/\bfetch\s*\(|process\.env|CLOUDFLARE_API_TOKEN|sk-[A-Za-z0-9]|BEGIN PRIVATE KEY/);
 assert.doesNotMatch(joined,/\bfetch\s*\(|scrap(e|ing)|kelly|wager|bankroll/i);
 assert.match(joined,/ExternalDeletionLedger/);assert.match(joined,/PostRestoreReconciliationPort/);assert.match(joined,/maxQuarantineMetadataBytes/);
});
