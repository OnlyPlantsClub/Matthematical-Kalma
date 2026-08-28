import { canonicalJsonText } from './canonical-json.ts';
import { deepFreeze, ok, type DomainResult } from './domain-validation.ts';
import { normalizeMarketObservation, type NormalizedMarketSnapshot } from './market-observation.ts';
import { verifyAuthenticatedRecord, type AuthenticatedIntelligenceRecord, type IntelligenceVerificationKeyProvider } from './authenticated-record.ts';
import { validateRightsSchedule, type RightsSchedule } from './intelligence-rights.ts';
import type { IntelligenceRecordRepository } from './intelligence-repository.ts';

export type QuarantineReason = 'malformed_envelope'|'hash_mismatch'|'mac_mismatch'|'wrong_environment'|'unknown_key'|'revoked_key'|'unsupported_version'|'rights_expired'|'deletion_required'|'parent_missing'|'fork_or_rollback_detected'|'current_domain_invalid'|'unsupported_record_type';
export interface QuarantinePlan { readonly version: 'intelligence-quarantine-plan/1'; readonly environmentId: string; readonly recordId?: string; readonly reason: QuarantineReason; readonly createdAt: string; readonly metadata: Readonly<{ failureCode: string; failurePath: string }> }
export interface AuditEvent { readonly version: 'intelligence-audit-event/1'; readonly eventId: string; readonly eventType: 'record_rehydrated'|'record_quarantined'|'deletion_planned'|'restore_reconciled'; readonly environmentId: string; readonly recordId?: string; readonly occurredAt: string; readonly metadata: Readonly<Record<string,string>> }
export interface RetentionDisposition { readonly status: 'retained'|'delete_required'|'deleted'; readonly legalHold: boolean; readonly deleteAfter?: string }
export interface RightsScheduleReader { getRightsSchedule(environmentId: string, scheduleId: string): Promise<unknown | undefined>; getRetentionDisposition(environmentId: string, recordId: string): Promise<RetentionDisposition | undefined> }
export interface ExternalDeletionLedger { isContractuallyDeleted(environmentId: string, recordId: string): Promise<boolean>; recordContractualDeletion(input: Readonly<{environmentId:string;recordId:string;deletedAt:string;basis:string}>): Promise<void> }
export interface PostRestoreReconciliationPort { reconcileBeforeServing(input: Readonly<{environmentId:string;restoredAt:string}>): Promise<Readonly<{status:'safe'|'blocked';checkedRecords:number}>> }
export interface BackupExpiry { readonly backupRef: string; readonly expiresAt: string; readonly includesThrough: string }
export interface DeletionPlan { readonly version:'intelligence-deletion-plan/1'; readonly environmentId:string; readonly recordId:string; readonly action:'retain'|'delete'; readonly executeAfter?:string; readonly basis:string; readonly legalHold:boolean }

export function planDeletion(record: AuthenticatedIntelligenceRecord, disposition: RetentionDisposition, now: string): DomainResult<DeletionPlan> {
  if (disposition.legalHold) return ok(deepFreeze({ version:'intelligence-deletion-plan/1', environmentId:record.environmentId, recordId:record.recordId, action:'retain', basis:'valid_legal_hold', legalHold:true }));
  const due = disposition.status === 'delete_required' || disposition.status === 'deleted' || !!(record.deleteAfter && Date.parse(now) >= Date.parse(record.deleteAfter));
  return ok(deepFreeze({ version:'intelligence-deletion-plan/1', environmentId:record.environmentId, recordId:record.recordId, action:due?'delete':'retain', ...(record.deleteAfter?{executeAfter:record.deleteAfter}:{}), basis:due?'retention_expired':'within_approved_retention', legalHold:false }));
}

export type RehydratedIntelligence = Readonly<{ record: AuthenticatedIntelligenceRecord; capability: NormalizedMarketSnapshot; audit: AuditEvent }>;
export type RehydrationResult = DomainResult<RehydratedIntelligence> | Readonly<{ok:false;error:Readonly<{code:'quarantine_required';message:string;path:string;metadata:Readonly<{plan:QuarantinePlan}>}>}>;
const REASON_MAP: Readonly<Record<string,QuarantineReason>> = Object.freeze({ hash_mismatch:'hash_mismatch',mac_mismatch:'mac_mismatch',wrong_environment:'wrong_environment',unknown_key:'unknown_key',revoked_key:'revoked_key',unsupported_version:'unsupported_version',unsupported_record_type:'unsupported_record_type' });
function quarantined(environmentId:string, recordId:string|undefined, now:string, code:string, path:string): RehydrationResult { const reason = REASON_MAP[code] ?? (code.includes('parent')?'parent_missing':'malformed_envelope'); const plan=deepFreeze({version:'intelligence-quarantine-plan/1' as const,environmentId,...(recordId?{recordId}:{}),reason,createdAt:now,metadata:{failureCode:code,failurePath:path}}); canonicalJsonText(plan, 2_048); return {ok:false,error:deepFreeze({code:'quarantine_required' as const,message:'Record requires quarantine; authenticated history is not repaired.',path,metadata:{plan}})}; }

export async function rehydrateIntelligenceRecord(input: unknown, context: Readonly<{ environmentId:string; now:string; keys:IntelligenceVerificationKeyProvider; repository:IntelligenceRecordRepository; rights:RightsScheduleReader; deletionLedger:ExternalDeletionLedger; auditEventId:string }>): Promise<RehydrationResult> {
  const recordId = typeof input === 'object' && input !== null && 'recordId' in input && typeof input.recordId === 'string' ? input.recordId : undefined;
  const verified = await verifyAuthenticatedRecord(input,context.environmentId,context.keys); if(!verified.ok) return quarantined(context.environmentId,recordId,context.now,verified.error.code,verified.error.path);
  const record=verified.value;
  if(await context.deletionLedger.isContractuallyDeleted(context.environmentId,record.recordId)) return quarantined(context.environmentId,record.recordId,context.now,'deletion_required','$.recordId');
  const rawRights=await context.rights.getRightsSchedule(context.environmentId,record.rightsScheduleId); const rights=validateRightsSchedule(rawRights); if(!rights.ok || rights.value.scheduleId!==record.rightsScheduleId || !rights.value.permittedRecordTypes.includes(record.recordType)) return quarantined(context.environmentId,record.recordId,context.now,'rights_expired','$.rightsScheduleId');
  const disposition=await context.rights.getRetentionDisposition(context.environmentId,record.recordId); if(!disposition || disposition.status!=='retained' || (!disposition.legalHold && record.deleteAfter && Date.parse(context.now)>=Date.parse(record.deleteAfter))) return quarantined(context.environmentId,record.recordId,context.now,'deletion_required','$.deleteAfter');
  for(const parent of record.parentRefs) if(!await context.repository.get(context.environmentId,parent)) return quarantined(context.environmentId,record.recordId,context.now,'parent_missing','$.parentRefs');
  if((await context.repository.getHead(context.environmentId,record.streamId))!==record.recordId) return quarantined(context.environmentId,record.recordId,context.now,'fork_or_rollback_detected','$.recordId');
  if(record.recordType!=='market_observation') return quarantined(context.environmentId,record.recordId,context.now,'unsupported_record_type','$.recordType');
  const capability=normalizeMarketObservation(record.payload); if(!capability.ok) return quarantined(context.environmentId,record.recordId,context.now,'current_domain_invalid',capability.error.path);
  const audit=deepFreeze({version:'intelligence-audit-event/1' as const,eventId:context.auditEventId,eventType:'record_rehydrated' as const,environmentId:context.environmentId,recordId:record.recordId,occurredAt:context.now,metadata:{recordType:record.recordType,rightsScheduleId:(rights.value as RightsSchedule).scheduleId}}); return ok(deepFreeze({record,capability:capability.value,audit}));
}
