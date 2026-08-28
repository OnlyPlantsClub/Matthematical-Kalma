import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJsonText, canonicalizeJson, CanonicalizationError } from '../src/domain/intelligence/canonical-json.ts';
import { HMAC_ALGORITHM, constantTimeEqual, issueAuthenticatedRecord, verifyAuthenticatedRecord } from '../src/domain/intelligence/authenticated-record.ts';
import { validateRightsSchedule } from '../src/domain/intelligence/intelligence-rights.ts';
import { rehydrateIntelligenceRecord } from '../src/domain/intelligence/intelligence-governance.ts';
import { D1IntelligenceRecordRepository } from '../src/domain/intelligence/intelligence-repository.ts';
import { normalizeMarketObservation, BASELINE_FRESHNESS_POLICY, SOURCE_ENVELOPE_CONTRACT_VERSION } from '../src/domain/intelligence/market-observation.ts';

const at='2026-08-29T01:00:00.000Z';
const keyBytes=new TextEncoder().encode('NON_PRODUCTION_TEST_ONLY_KEY_MATERIAL_32');
const cryptoKey=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
const active={environmentId:'test',keyId:'test-key-v1',algorithm:HMAC_ALGORITHM,status:'active',activatesAt:'2026-01-01T00:00:00.000Z',cryptoKey};
const keyProvider={async getActiveSigningKey(environmentId){return environmentId==='test'?active:undefined},async getVerificationKey(environmentId,keyId){return environmentId==='test'&&keyId===active.keyId?active:undefined}};
const rights={contractVersion:'intelligence-retention/1',scheduleId:'synthetic-v1',sourceClass:'synthetic_project_owned',permittedRecordTypes:['market_observation'],ownerRef:'project:matthematical-kalma',retentionBasis:'project_owned_fixture',indefiniteBasis:'project_owned_synthetic_fixture',rawPayloadPolicy:'project_fixture_allowed',derivativePolicy:'project_use',replayMode:'full_payload_retained',backupExportAllowance:'project_backups',exitDisposition:'retain_project_fixture',legalHoldHandling:'not_applicable'};
const payload={sourceEnvelope:{contractVersion:SOURCE_ENVELOPE_CONTRACT_VERSION,sourceId:'synthetic-market',providerRef:'project:synthetic',sourceSchemaVersion:'fixture/v1',termsRef:'rights:synthetic-v1',adapter:{id:'synthetic-fixture',version:'1'},retrievalMethod:'manual',observedAt:'2026-08-29T00:59:00.000Z',effectiveAt:'2026-08-29T00:59:00.000Z',receivedAt:'2026-08-29T00:59:00.000Z',retention:{replayMode:'hash_only_verification',payloadHash:`sha256:${'a'.repeat(64)}`}},sportId:'afl',competitionId:'afl-men',eventId:'event-1',marketId:'winner-v1',eventStartAt:'2026-08-29T03:00:00.000Z',asOf:'2026-08-29T00:59:30.000Z',freshnessPolicy:BASELINE_FRESHNESS_POLICY,completeness:'complete',marketAvailability:'active',outcomes:[{outcomeId:'home',decimalOdds:'1.90',availability:'active',observationRef:'quote/home',identity:{sportId:'afl',competitionId:'afl-men',eventId:'event-1',marketId:'winner-v1',outcomeId:'home'}},{outcomeId:'away',decimalOdds:'1.90',availability:'active',observationRef:'quote/away',identity:{sportId:'afl',competitionId:'afl-men',eventId:'event-1',marketId:'winner-v1',outcomeId:'away'}}]};
const issue=(overrides={})=>issueAuthenticatedRecord({recordType:'market_observation',recordId:'rec-1',environmentId:'test',streamId:'market-stream-1',parentRefs:[],issuedAt:at,validatedAt:at,issuer:'test-suite',payload,rightsSchedule:rights,...overrides},keyProvider);
const value=(result)=>{assert.equal(result.ok,true,result.ok?undefined:result.error.code);return result.value};

test('RFC 8785 canonical ordering, escaping and number fixtures are deterministic',()=>{
 assert.equal(canonicalJsonText({b:1,a:'x'}),'{"a":"x","b":1}');
 assert.equal(canonicalJsonText({numbers:[333333333.33333329,1e30,4.50,2e-3,1e-27],literals:[null,true,false]}),'{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27]}');
 assert.equal(canonicalJsonText({'€':'euro','\r':'cr','1':'one','😀':'grin','ö':'latin'}),'{"\\r":"cr","1":"one","ö":"latin","€":"euro","😀":"grin"}');
 assert.equal(canonicalJsonText({}), '{}'); assert.equal(canonicalJsonText([]),'[]');
 for(const bad of [NaN,Infinity,1n,undefined,()=>{},Symbol('x'),Object.create({hostile:true})]) assert.throws(()=>canonicalizeJson(bad),CanonicalizationError);
 const sparse=new Array(1); assert.throws(()=>canonicalizeJson(sparse),CanonicalizationError); const cycle={};cycle.self=cycle;assert.throws(()=>canonicalizeJson(cycle),CanonicalizationError); const shared={x:1};assert.throws(()=>canonicalizeJson([shared,shared]),CanonicalizationError);
 const accessor={};Object.defineProperty(accessor,'x',{get(){throw new Error('must not run')}});assert.throws(()=>canonicalizeJson(accessor),CanonicalizationError);
 assert.equal(canonicalJsonText('123',5),'"123"'); assert.throws(()=>canonicalJsonText('123',4),(error)=>error.code==='canonical_size_exceeded');
});

test('known SHA-256 and HMAC vectors and constant-time comparator boundaries',async()=>{
 const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('abc'))).toString('hex'); assert.equal(digest,'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 const vectorKey=await crypto.subtle.importKey('raw',new Uint8Array(20).fill(0x0b),{name:'HMAC',hash:'SHA-256'},false,['sign']); const mac=Buffer.from(await crypto.subtle.sign('HMAC',vectorKey,new TextEncoder().encode('Hi There'))).toString('hex'); assert.equal(mac,'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
 assert.equal(constantTimeEqual(new Uint8Array(),new Uint8Array()),true);assert.equal(constantTimeEqual(Uint8Array.of(1),Uint8Array.of(1)),true);assert.equal(constantTimeEqual(Uint8Array.of(1),Uint8Array.of(2)),false);assert.equal(constantTimeEqual(Uint8Array.of(1),Uint8Array.of(1,0)),false);
});

test('authenticated envelope binds payload and every header field',async()=>{
 const record=value(await issue()); assert.equal((await verifyAuthenticatedRecord(record,'test',keyProvider)).ok,true); assert.ok(Object.isFrozen(record)); assert.ok(Object.isFrozen(record.payload));
 const payloadMutation=structuredClone(record);payloadMutation.payload.marketId='other';assert.equal((await verifyAuthenticatedRecord(payloadMutation,'test',keyProvider)).error.code,'hash_mismatch');
 const mutations={recordType:'canonical_result_observation',recordId:'rec-2',schemaVersion:'mk-intelligence-record-jcs/2',contractVersion:'authenticated-intelligence-record/2',environmentId:'other',streamId:'other-stream',parentRefs:['parent-1'],issuedAt:'2026-08-29T00:59:59.000Z',validatedAt:'2026-08-29T01:00:01.000Z',issuer:'other',keyId:'other-key',rightsScheduleId:'other-rights',retentionPolicyVersion:'intelligence-retention/2',providerDisposition:'provider',deleteAfter:'2027-01-01T00:00:00.000Z',indefiniteBasis:undefined,legalHold:true,replayMode:'hash_only_verification'};
 for(const [field,replacement] of Object.entries(mutations)){const changed=structuredClone(record);if(replacement===undefined)delete changed[field];else changed[field]=replacement;const result=await verifyAuthenticatedRecord(changed,field==='environmentId'?'other':'test',keyProvider);assert.equal(result.ok,false,field);}
});

test('key status, environment, rotation and rights fail closed',async()=>{
 const record=value(await issue()); assert.equal((await verifyAuthenticatedRecord(record,'other',keyProvider)).error.code,'wrong_environment');
 assert.equal((await verifyAuthenticatedRecord(record,'test',{async getVerificationKey(){return undefined}})).error.code,'unknown_key');
 for(const status of ['revoked','unavailable']) assert.equal((await verifyAuthenticatedRecord(record,'test',{async getVerificationKey(){return {...active,status}}})).error.code,'revoked_key');
 assert.equal((await verifyAuthenticatedRecord(record,'test',{async getVerificationKey(){return {...active,status:'verify-only'}}})).ok,true);
 assert.equal(validateRightsSchedule({...rights,sourceClass:'provider_derived'}).error.code,'source_not_permitted'); assert.equal(validateRightsSchedule({...rights,sourceClass:'manual_user_owned'}).error.code,'ownership_evidence_required');
});

test('rehydration revalidates into a new capability and persisted clones have no authority',async()=>{
 const record=value(await issue()); const normalized=value(normalizeMarketObservation(payload)); assert.notEqual(record.payload,normalized);
 const repository={async append(){throw new Error('unused')},async get(){return record},async getHead(){return record.recordId}}; const governance={async getRightsSchedule(){return rights},async getRetentionDisposition(){return {status:'retained',legalHold:false}}}; const ledger={async isContractuallyDeleted(){return false},async recordContractualDeletion(){}};
 const result=await rehydrateIntelligenceRecord(JSON.parse(JSON.stringify(record)),{environmentId:'test',now:at,keys:keyProvider,repository,rights:governance,deletionLedger:ledger,auditEventId:'audit-1'}); const rehydrated=value(result); assert.notEqual(rehydrated.capability,record.payload);assert.deepEqual(rehydrated.capability,normalized);assert.ok(Object.isFrozen(rehydrated));assert.equal(JSON.stringify(rehydrated.audit).includes('decimalOdds'),false);
 const invalid=value(await issue({payload:{...payload,outcomes:[]}})); const quarantined=await rehydrateIntelligenceRecord(invalid,{environmentId:'test',now:at,keys:keyProvider,repository,rights:governance,deletionLedger:ledger,auditEventId:'audit-2'}); assert.equal(quarantined.ok,false);assert.equal(JSON.stringify(quarantined).includes('decimalOdds'),false);
});

test('repository batches record, head, retention and audit atomically with idempotent retry',async()=>{
 const record=value(await issue());
 class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.values=[]}bind(...values){this.values=values;return this}async first(){if(this.sql.includes('idempotency_key'))return this.db.existing;return null}}
 class FakeD1{constructor(){this.existing=null;this.batches=[];this.failure=''}prepare(sql){return new Statement(this,sql)}async batch(items){if(this.failure)throw new Error(this.failure);this.batches.push(items);return items.map(()=>({success:true}))}}
 const db=new FakeD1(),repository=new D1IntelligenceRecordRepository(db),request={record,idempotencyKey:'idem-1',auditEventId:'audit-append-1',appendedAt:at};
 const appended=value(await repository.append(request));assert.equal(appended.status,'appended');assert.equal(db.batches.length,1);assert.equal(db.batches[0].length,4);assert.ok(db.batches[0].some(({sql})=>sql.includes('intelligence_stream_heads')));assert.ok(db.batches[0].some(({sql})=>sql.includes('intelligence_retention_dispositions')));assert.ok(db.batches[0].some(({sql})=>sql.includes('intelligence_audit_events')));
 db.existing={record_id:record.recordId,content_hash:record.contentHash,authentication_tag:record.authenticationTag,stream_id:record.streamId};assert.equal(value(await repository.append(request)).status,'idempotent');assert.equal(db.batches.length,1);
 db.existing={...db.existing,content_hash:`sha256:${'0'.repeat(64)}`};assert.equal((await repository.append(request)).error.code,'idempotency_collision');
 db.existing=null;for(const [message,code] of [['intelligence_head_conflict','head_conflict'],['intelligence_parent_scope_conflict','parent_scope_conflict'],['FOREIGN KEY constraint failed','missing_parent_or_rights'],['UNIQUE constraint failed','duplicate_record'],['disk unavailable','append_failed']]){db.failure=message;assert.equal((await repository.append({...request,idempotencyKey:`idem-${code}`})).error.code,code)}
});
