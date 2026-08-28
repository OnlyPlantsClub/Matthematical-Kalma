import { deepFreeze, fail, ok, snapshot, type DomainResult } from './domain-validation.ts';

export const RETENTION_CONTRACT_VERSION = 'intelligence-retention/1';
export const RIGHTS_LIMITS = Object.freeze({ maxScheduleIdLength: 128, maxEvidenceRefLength: 256 } as const);
export type IntelligenceSourceClass = 'synthetic_project_owned' | 'manual_user_owned';
export type IntelligenceRecordType = 'market_observation' | 'canonical_result_observation';

export interface RightsSchedule {
  readonly contractVersion: typeof RETENTION_CONTRACT_VERSION;
  readonly scheduleId: string;
  readonly sourceClass: IntelligenceSourceClass;
  readonly permittedRecordTypes: readonly IntelligenceRecordType[];
  readonly ownerRef: string;
  readonly authorizationEvidenceRef?: string;
  readonly retentionBasis: 'project_owned_fixture' | 'explicit_user_authorization';
  readonly maximumRetentionDays?: number;
  readonly indefiniteBasis?: 'project_owned_synthetic_fixture';
  readonly rawPayloadPolicy: 'project_fixture_allowed' | 'user_authored_fixture_allowed';
  readonly derivativePolicy: 'project_use' | 'authorized_private_use';
  readonly replayMode: 'full_payload_retained';
  readonly backupExportAllowance: 'project_backups' | 'authorized_user_export';
  readonly exitDisposition: 'retain_project_fixture' | 'delete_user_fixture';
  readonly legalHoldHandling: 'not_applicable' | 'honour_valid_hold';
  readonly provenanceContractVersion: 'project-synthetic-provenance/1' | 'user-owned-manual-provenance/1';
  readonly hardSourceRightsDeleteAfter?: string;
}

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/;
export function validateRightsSchedule(input: unknown): DomainResult<RightsSchedule> {
  const safe = snapshot(input); if (!safe.ok) return fail('invalid_rights_schedule', safe.error.message, safe.error.path);
  if (typeof safe.value !== 'object' || safe.value === null || Array.isArray(safe.value)) return fail('invalid_rights_schedule', 'Rights schedule must be an object.', '$');
  const value = safe.value as Record<string, unknown>;
  const allowed = new Set(['contractVersion', 'scheduleId', 'sourceClass', 'permittedRecordTypes', 'ownerRef', 'authorizationEvidenceRef', 'retentionBasis', 'maximumRetentionDays', 'indefiniteBasis', 'rawPayloadPolicy', 'derivativePolicy', 'replayMode', 'backupExportAllowance', 'exitDisposition', 'legalHoldHandling', 'provenanceContractVersion', 'hardSourceRightsDeleteAfter']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) return fail('unknown_field', 'Unknown rights-schedule field.', `$.${key}`);
  if (value.contractVersion !== RETENTION_CONTRACT_VERSION) return fail('unsupported_version', 'Unsupported retention contract.', '$.contractVersion');
  if (typeof value.scheduleId !== 'string' || value.scheduleId.length < 1 || value.scheduleId.length > RIGHTS_LIMITS.maxScheduleIdLength || !REF.test(value.scheduleId)) return fail('invalid_rights_schedule', 'Invalid schedule ID.', '$.scheduleId');
  if (value.sourceClass !== 'synthetic_project_owned' && value.sourceClass !== 'manual_user_owned') return fail('source_not_permitted', 'Only project synthetic and explicitly user-owned manual fixtures are permitted.', '$.sourceClass');
  if (!Array.isArray(value.permittedRecordTypes) || value.permittedRecordTypes.length < 1 || value.permittedRecordTypes.length > 2 || value.permittedRecordTypes.some((item) => item !== 'market_observation' && item !== 'canonical_result_observation') || new Set(value.permittedRecordTypes).size !== value.permittedRecordTypes.length) return fail('invalid_rights_schedule', 'Invalid permitted record types.', '$.permittedRecordTypes');
  for (const field of ['ownerRef'] as const) if (typeof value[field] !== 'string' || value[field].length < 1 || value[field].length > RIGHTS_LIMITS.maxEvidenceRefLength || !REF.test(value[field] as string)) return fail('invalid_rights_schedule', `Invalid ${field}.`, `$.${field}`);
  const manual = value.sourceClass === 'manual_user_owned';
  if (manual && (typeof value.authorizationEvidenceRef !== 'string' || value.authorizationEvidenceRef.length < 1 || value.authorizationEvidenceRef.length > RIGHTS_LIMITS.maxEvidenceRefLength || !REF.test(value.authorizationEvidenceRef))) return fail('ownership_evidence_required', 'Manual fixtures require explicit user ownership evidence.', '$.authorizationEvidenceRef');
  if (!manual && value.authorizationEvidenceRef !== undefined) return fail('contradictory_rights', 'Synthetic project fixtures do not use user authorization evidence.', '$.authorizationEvidenceRef');
  if (value.retentionBasis !== (manual ? 'explicit_user_authorization' : 'project_owned_fixture')) return fail('contradictory_rights', 'Retention basis contradicts source class.', '$.retentionBasis');
  if (value.rawPayloadPolicy !== (manual ? 'user_authored_fixture_allowed' : 'project_fixture_allowed')) return fail('contradictory_rights', 'Raw-payload policy contradicts source class.', '$.rawPayloadPolicy');
  if (value.derivativePolicy !== (manual ? 'authorized_private_use' : 'project_use') || value.replayMode !== 'full_payload_retained' || value.backupExportAllowance !== (manual ? 'authorized_user_export' : 'project_backups') || value.exitDisposition !== (manual ? 'delete_user_fixture' : 'retain_project_fixture') || value.legalHoldHandling !== (manual ? 'honour_valid_hold' : 'not_applicable')) return fail('contradictory_rights', 'Rights disposition contradicts source class.', '$');
  if (value.provenanceContractVersion !== (manual ? 'user-owned-manual-provenance/1' : 'project-synthetic-provenance/1')) return fail('contradictory_rights', 'Provenance contract contradicts source class.', '$.provenanceContractVersion');
  if (manual) {
    if (!Number.isSafeInteger(value.maximumRetentionDays) || (value.maximumRetentionDays as number) < 1 || (value.maximumRetentionDays as number) > 730 || value.indefiniteBasis !== undefined) return fail('invalid_retention', 'Manual fixtures require a maximum of 1-730 days and cannot be indefinite.', '$.maximumRetentionDays');
    if (typeof value.hardSourceRightsDeleteAfter !== 'string' || Number.isNaN(Date.parse(value.hardSourceRightsDeleteAfter)) || new Date(Date.parse(value.hardSourceRightsDeleteAfter)).toISOString() !== value.hardSourceRightsDeleteAfter) return fail('invalid_retention', 'Manual fixtures require a canonical hard source-rights deadline.', '$.hardSourceRightsDeleteAfter');
  } else if (value.indefiniteBasis !== 'project_owned_synthetic_fixture' || value.maximumRetentionDays !== undefined || value.hardSourceRightsDeleteAfter !== undefined) return fail('invalid_retention', 'Synthetic indefinite retention requires its explicit approved basis.', '$.indefiniteBasis');
  return ok(deepFreeze(value as unknown as RightsSchedule));
}

export function calculateDeleteAfter(schedule: RightsSchedule, issuedAt: string): string | undefined {
  if (schedule.indefiniteBasis) return undefined;
  return new Date(Date.parse(issuedAt) + (schedule.maximumRetentionDays ?? 0) * 86_400_000).toISOString();
}
