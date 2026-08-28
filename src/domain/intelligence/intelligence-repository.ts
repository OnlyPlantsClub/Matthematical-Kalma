import { canonicalJsonText } from './canonical-json.ts';
import { deepFreeze, fail, ok, type DomainResult } from './domain-validation.ts';
import { RECORD_LIMITS, type AuthenticatedIntelligenceRecord } from './authenticated-record.ts';

export interface D1PreparedStatementLike { bind(...values: unknown[]): D1PreparedStatementLike; first<T = Record<string, unknown>>(): Promise<T | null> }
export interface D1ResultLike { readonly success: boolean; readonly meta?: Readonly<{ changes?: number }> }
export interface D1DatabaseLike { prepare(query: string): D1PreparedStatementLike; batch(statements: D1PreparedStatementLike[]): Promise<D1ResultLike[]> }
export interface AppendRequest { readonly record: AuthenticatedIntelligenceRecord; readonly idempotencyKey: string; readonly auditEventId: string; readonly appendedAt: string }
export interface AppendResult { readonly status: 'appended' | 'idempotent'; readonly recordId: string; readonly streamId: string }
export interface IntelligenceRecordRepository { append(request: AppendRequest): Promise<DomainResult<AppendResult>>; get(environmentId: string, recordId: string): Promise<AuthenticatedIntelligenceRecord | undefined>; getHead(environmentId: string, streamId: string): Promise<string | undefined> }

const IDEMPOTENCY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
type Existing = { record_id: string; content_hash: string; authentication_tag: string; stream_id: string };

export class D1IntelligenceRecordRepository implements IntelligenceRecordRepository {
  private readonly db: D1DatabaseLike;
  constructor(db: D1DatabaseLike) { this.db = db; }
  async append(request: AppendRequest): Promise<DomainResult<AppendResult>> {
    if (!IDEMPOTENCY.test(request.idempotencyKey)) return fail('invalid_idempotency_key', 'Idempotency key is invalid.', '$.idempotencyKey');
    const record = request.record;
    const existing = await this.db.prepare('SELECT record_id,content_hash,authentication_tag,stream_id FROM authenticated_intelligence_records WHERE environment_id=? AND idempotency_key=?').bind(record.environmentId, request.idempotencyKey).first<Existing>();
    if (existing) return existing.content_hash === record.contentHash && existing.authentication_tag === record.authenticationTag && existing.record_id === record.recordId
      ? ok(deepFreeze({ status: 'idempotent', recordId: existing.record_id, streamId: existing.stream_id }))
      : fail('idempotency_collision', 'Idempotency key was already used for different authenticated content.', '$.idempotencyKey');
    const payloadJcs = canonicalJsonText(record.payload, RECORD_LIMITS.maxPayloadBytes);
    const header = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'payload' && key !== 'contentHash' && key !== 'authenticationTag'));
    const headerJcs = canonicalJsonText(header);
    const parentHead = record.parentRefs[0] ?? null;
    const statements = [
      this.db.prepare('INSERT INTO authenticated_intelligence_records(environment_id,record_id,stream_id,record_type,schema_version,contract_version,rights_schedule_id,key_id,idempotency_key,content_hash,authentication_tag,header_jcs,payload_jcs,parent_head_id,corrects_record_id,issued_at,validated_at,delete_after,indefinite_basis) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(record.environmentId,record.recordId,record.streamId,record.recordType,record.schemaVersion,record.contractVersion,record.rightsScheduleId,record.keyId,request.idempotencyKey,record.contentHash,record.authenticationTag,headerJcs,payloadJcs,parentHead,record.correctsRecordId ?? null,record.issuedAt,record.validatedAt,record.deleteAfter ?? null,record.indefiniteBasis ?? null),
      ...record.parentRefs.map((parent, ordinal) => this.db.prepare('INSERT INTO intelligence_record_parents(environment_id,child_record_id,parent_record_id,ordinal) VALUES(?,?,?,?)').bind(record.environmentId,record.recordId,parent,ordinal)),
      parentHead === null
        ? this.db.prepare('INSERT INTO intelligence_stream_heads(environment_id,stream_id,record_type,current_record_id,revision) VALUES(?,?,?,?,1)').bind(record.environmentId,record.streamId,record.recordType,record.recordId)
        : this.db.prepare('UPDATE intelligence_stream_heads SET current_record_id=?,revision=revision+1 WHERE environment_id=? AND stream_id=? AND current_record_id=?').bind(record.recordId,record.environmentId,record.streamId,parentHead),
      this.db.prepare('INSERT INTO intelligence_retention_dispositions(environment_id,record_id,status,delete_after,indefinite_basis,legal_hold,planned_at) VALUES(?,?,?,?,?,0,?)').bind(record.environmentId,record.recordId,'retained',record.deleteAfter ?? null,record.indefiniteBasis ?? null,request.appendedAt),
      this.db.prepare('INSERT INTO intelligence_audit_events(environment_id,event_id,event_type,record_id,occurred_at,metadata_jcs) VALUES(?,?,?,?,?,?)').bind(record.environmentId,request.auditEventId,'record_appended',record.recordId,request.appendedAt,canonicalJsonText({ streamId: record.streamId, recordType: record.recordType })),
    ];
    try { await this.db.batch(statements); return ok(deepFreeze({ status: 'appended', recordId: record.recordId, streamId: record.streamId })); }
    catch (error) { const message = error instanceof Error ? error.message : ''; if (message.includes('intelligence_head_conflict') || message.includes('intelligence_single_successor')) return fail('head_conflict', 'Stream head changed or would fork.', '$.record.parentRefs'); if (message.includes('parent_scope')) return fail('parent_scope_conflict', 'Parent belongs to another stream or type.', '$.record.parentRefs'); if (message.includes('FOREIGN KEY')) return fail('missing_parent_or_rights', 'Required parent, rights schedule or key metadata is missing.', '$.record'); if (message.includes('UNIQUE')) return fail('duplicate_record', 'Immutable record identity or content already exists.', '$.record'); return fail('append_failed', 'Atomic append failed.', '$.record'); }
  }
  async get(environmentId: string, recordId: string): Promise<AuthenticatedIntelligenceRecord | undefined> { const row = await this.db.prepare('SELECT header_jcs,payload_jcs,content_hash,authentication_tag FROM authenticated_intelligence_records WHERE environment_id=? AND record_id=?').bind(environmentId,recordId).first<{header_jcs:string;payload_jcs:string;content_hash:string;authentication_tag:string}>(); return row ? { ...JSON.parse(row.header_jcs), payload: JSON.parse(row.payload_jcs), contentHash: row.content_hash, authenticationTag: row.authentication_tag } as AuthenticatedIntelligenceRecord : undefined; }
  async getHead(environmentId: string, streamId: string): Promise<string | undefined> { return (await this.db.prepare('SELECT current_record_id FROM intelligence_stream_heads WHERE environment_id=? AND stream_id=?').bind(environmentId,streamId).first<{current_record_id:string}>())?.current_record_id; }
}
