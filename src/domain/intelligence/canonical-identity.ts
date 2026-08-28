import type { JsonValue } from './untrusted-json.ts';
import {
  DOMAIN_REASON_MAX, DOMAIN_VERSION_MAX, boundedText, fail, identifier, isRecord, ok, record,
  reference, shape, snapshot, stringArray, timestamp, type DomainError, type DomainResult,
} from './domain-validation.ts';

export const CANONICAL_IDENTITY_CONTRACT_VERSION = 'canonical-identity-v1';
export const ALIAS_RESOLUTION_POLICY = Object.freeze({ id: 'exact-evidence-only', version: '1' } as const);
export const MAX_EVENT_PARTICIPANTS = 16;
export const MAX_ALIAS_CANDIDATES = 16;
export const MAX_EVIDENCE_REFS = 16;

export type CanonicalEntityType = 'sport' | 'competition' | 'participant' | 'event';
export type EventParticipantRole = 'home' | 'away' | 'competitor' | 'draw';
export interface CanonicalEventParticipant {
  readonly participantId: string;
  readonly role: EventParticipantRole;
  readonly roleVersion: string;
  readonly evidenceRefs: readonly string[];
}

export interface CanonicalIdentity {
  readonly contractVersion: typeof CANONICAL_IDENTITY_CONTRACT_VERSION;
  readonly entityType: CanonicalEntityType;
  readonly canonicalId: string;
  readonly version: string;
  readonly evidenceRefs: readonly string[];
  readonly sportId?: string;
  readonly competitionId?: string;
  readonly eventStartAt?: string;
  readonly participants?: readonly CanonicalEventParticipant[];
}

export interface ProviderAlias {
  readonly contractVersion: 'provider-alias-v1';
  readonly aliasRef: string;
  readonly entityType: CanonicalEntityType;
  readonly sourceId: string;
  readonly providerRef: string;
  readonly externalKey: string;
  readonly canonicalId?: string;
  readonly sportId?: string;
  readonly competitionId?: string;
  readonly eventStartAt?: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly status: 'resolved' | 'unresolved' | 'ambiguous' | 'quarantined' | 'superseded';
  readonly evidenceRefs: readonly string[];
  readonly version: string;
  readonly previousCanonicalId?: string;
  readonly supersededByAliasRef?: string;
  readonly supersessionReason?: string;
}

export interface AliasCandidate {
  readonly candidateRef: string;
  readonly canonicalId: string;
  readonly entityType: CanonicalEntityType;
  readonly sourceId: string;
  readonly providerRef: string;
  readonly externalKey: string;
  readonly sportId?: string;
  readonly competitionId?: string;
  readonly eventStartAt?: string;
  readonly evidenceRefs: readonly string[];
  readonly evidenceKind: 'exact_source_key' | 'display_name_similarity';
}

export type AliasResolution = Readonly<{
  contractVersion: 'alias-resolution-v1';
  status: 'resolved' | 'unresolved' | 'quarantined' | 'superseded';
  alias: ProviderAlias;
  policy: typeof ALIAS_RESOLUTION_POLICY;
  reason: string;
  canonicalId?: string;
  candidateRefs: readonly string[];
  evidenceRefs: readonly string[];
}>;

function enumValue<T extends string>(value: JsonValue | undefined, values: readonly T[], path: string): DomainResult<T> {
  return typeof value === 'string' && values.includes(value as T) ? ok(value as T) : fail('invalid_enum', 'Value is not supported by this contract.', path);
}
function optionalId(value: JsonValue | undefined, path: string): DomainResult<string | undefined> {
  return value === undefined ? ok(undefined) : identifier(value, path);
}
function optionalTime(value: JsonValue | undefined, path: string): DomainResult<string | undefined> {
  if (value === undefined) return ok(undefined);
  const parsed = timestamp(value, path); return parsed.ok ? ok(parsed.value.canonical) : parsed;
}

function parseParticipant(value: JsonValue, path: string): DomainResult<CanonicalEventParticipant> {
  const parsed = record(value, path); if (!parsed.ok) return parsed;
  const exact = shape(parsed.value, ['participantId', 'role', 'roleVersion', 'evidenceRefs'], path); if (!exact.ok) return exact;
  const id = identifier(parsed.value.participantId, `${path}.participantId`); if (!id.ok) return id;
  const role = enumValue(parsed.value.role, ['home', 'away', 'competitor', 'draw'], `${path}.role`); if (!role.ok) return role;
  const version = reference(parsed.value.roleVersion, `${path}.roleVersion`, DOMAIN_VERSION_MAX); if (!version.ok) return version;
  const evidence = stringArray(parsed.value.evidenceRefs, `${path}.evidenceRefs`, MAX_EVIDENCE_REFS); if (!evidence.ok) return evidence;
  return ok({ participantId: id.value, role: role.value, roleVersion: version.value, evidenceRefs: evidence.value });
}

function normalizeCanonicalIdentityTrusted(value: JsonValue): DomainResult<CanonicalIdentity> {
  const parsed = record(value, '$'); if (!parsed.ok) return parsed;
  const exact = shape(parsed.value, ['contractVersion', 'entityType', 'canonicalId', 'version', 'evidenceRefs', 'sportId', 'competitionId', 'eventStartAt', 'participants'], '$');
  if (!exact.ok) return exact;
  if (parsed.value.contractVersion !== CANONICAL_IDENTITY_CONTRACT_VERSION) return fail('unsupported_version', 'Canonical identity contract version is unsupported.', '$.contractVersion');
  const entityType = enumValue(parsed.value.entityType, ['sport', 'competition', 'participant', 'event'], '$.entityType'); if (!entityType.ok) return entityType;
  const canonicalId = identifier(parsed.value.canonicalId, '$.canonicalId'); if (!canonicalId.ok) return canonicalId;
  const version = reference(parsed.value.version, '$.version', DOMAIN_VERSION_MAX); if (!version.ok) return version;
  const evidence = stringArray(parsed.value.evidenceRefs, '$.evidenceRefs', MAX_EVIDENCE_REFS); if (!evidence.ok) return evidence;
  const sportId = optionalId(parsed.value.sportId, '$.sportId'); if (!sportId.ok) return sportId;
  const competitionId = optionalId(parsed.value.competitionId, '$.competitionId'); if (!competitionId.ok) return competitionId;
  const eventStartAt = optionalTime(parsed.value.eventStartAt, '$.eventStartAt'); if (!eventStartAt.ok) return eventStartAt;
  if (entityType.value === 'sport' && (sportId.value || competitionId.value || eventStartAt.value || parsed.value.participants !== undefined))
    return fail('identity_conflict', 'Sport identity cannot declare parent or event fields.', '$');
  if (entityType.value === 'competition' && (!sportId.value || competitionId.value || eventStartAt.value || parsed.value.participants !== undefined))
    return fail('identity_conflict', 'Competition identity requires only a sport parent.', '$');
  if (entityType.value === 'participant' && (!sportId.value || eventStartAt.value || parsed.value.participants !== undefined))
    return fail('identity_conflict', 'Participant identity requires sport and may declare competition only.', '$');
  let participants: CanonicalIdentity['participants'];
  if (entityType.value === 'event') {
    if (!sportId.value || !competitionId.value || !eventStartAt.value || !Array.isArray(parsed.value.participants))
      return fail('identity_conflict', 'Event identity requires sport, competition, start time and participants.', '$');
    if (parsed.value.participants.length < 2 || parsed.value.participants.length > MAX_EVENT_PARTICIPANTS)
      return fail('limit_exceeded', `Event requires 2-${MAX_EVENT_PARTICIPANTS} participants.`, '$.participants');
    const output: NonNullable<CanonicalIdentity['participants']>[number][] = []; const seenIds = new Set<string>(); const seenRoles = new Set<string>();
    for (let index = 0; index < parsed.value.participants.length; index += 1) {
      const item = parseParticipant(parsed.value.participants[index], `$.participants[${index}]`); if (!item.ok) return item;
      if (seenIds.has(item.value.participantId)) return fail('duplicate_participant', 'Participant IDs must be unique in an event.', `$.participants[${index}].participantId`, { inputIndex: index, entityRef: item.value.participantId });
      if ((item.value.role === 'home' || item.value.role === 'away' || item.value.role === 'draw') && seenRoles.has(item.value.role))
        return fail('duplicate_role', 'Singleton event roles must be unique.', `$.participants[${index}].role`, { inputIndex: index });
      seenIds.add(item.value.participantId); seenRoles.add(item.value.role); output.push(item.value);
    }
    participants = output;
  }
  return ok({ contractVersion: CANONICAL_IDENTITY_CONTRACT_VERSION, entityType: entityType.value, canonicalId: canonicalId.value,
    version: version.value, evidenceRefs: evidence.value, ...(sportId.value ? { sportId: sportId.value } : {}),
    ...(competitionId.value ? { competitionId: competitionId.value } : {}), ...(eventStartAt.value ? { eventStartAt: eventStartAt.value } : {}),
    ...(participants ? { participants } : {}) });
}

export function normalizeCanonicalIdentity(input: unknown): DomainResult<CanonicalIdentity> {
  const safe = snapshot(input); return safe.ok ? normalizeCanonicalIdentityTrusted(safe.value) : safe;
}

function parseAlias(value: JsonValue, path = '$.alias'): DomainResult<ProviderAlias> {
  const parsed = record(value, path); if (!parsed.ok) return parsed;
  const exact = shape(parsed.value, ['contractVersion', 'aliasRef', 'entityType', 'sourceId', 'providerRef', 'externalKey', 'canonicalId', 'sportId', 'competitionId', 'eventStartAt', 'effectiveFrom', 'effectiveTo', 'status', 'evidenceRefs', 'version', 'previousCanonicalId', 'supersededByAliasRef', 'supersessionReason'], path); if (!exact.ok) return exact;
  if (parsed.value.contractVersion !== 'provider-alias-v1') return fail('unsupported_version', 'Provider alias contract version is unsupported.', `${path}.contractVersion`);
  const aliasRef = reference(parsed.value.aliasRef, `${path}.aliasRef`); if (!aliasRef.ok) return aliasRef;
  const entityType = enumValue(parsed.value.entityType, ['sport', 'competition', 'participant', 'event'], `${path}.entityType`); if (!entityType.ok) return entityType;
  const sourceId = identifier(parsed.value.sourceId, `${path}.sourceId`); if (!sourceId.ok) return sourceId;
  const providerRef = reference(parsed.value.providerRef, `${path}.providerRef`); if (!providerRef.ok) return providerRef;
  const externalKey = reference(parsed.value.externalKey, `${path}.externalKey`); if (!externalKey.ok) return externalKey;
  const canonicalId = optionalId(parsed.value.canonicalId, `${path}.canonicalId`); if (!canonicalId.ok) return canonicalId;
  const sportId = optionalId(parsed.value.sportId, `${path}.sportId`); if (!sportId.ok) return sportId;
  const competitionId = optionalId(parsed.value.competitionId, `${path}.competitionId`); if (!competitionId.ok) return competitionId;
  const eventStartAt = optionalTime(parsed.value.eventStartAt, `${path}.eventStartAt`); if (!eventStartAt.ok) return eventStartAt;
  const from = timestamp(parsed.value.effectiveFrom, `${path}.effectiveFrom`); if (!from.ok) return from;
  const to = optionalTime(parsed.value.effectiveTo, `${path}.effectiveTo`); if (!to.ok) return to;
  if (to.value && Date.parse(to.value) <= from.value.milliseconds) return fail('invalid_effective_range', 'Effective end must be after effective start.', `${path}.effectiveTo`);
  const status = enumValue(parsed.value.status, ['resolved', 'unresolved', 'ambiguous', 'quarantined', 'superseded'], `${path}.status`); if (!status.ok) return status;
  const evidenceRefs = stringArray(parsed.value.evidenceRefs, `${path}.evidenceRefs`, MAX_EVIDENCE_REFS); if (!evidenceRefs.ok) return evidenceRefs;
  const version = reference(parsed.value.version, `${path}.version`, DOMAIN_VERSION_MAX); if (!version.ok) return version;
  const previous = optionalId(parsed.value.previousCanonicalId, `${path}.previousCanonicalId`); if (!previous.ok) return previous;
  const supersededBy = parsed.value.supersededByAliasRef === undefined ? ok<string | undefined>(undefined) : reference(parsed.value.supersededByAliasRef, `${path}.supersededByAliasRef`); if (!supersededBy.ok) return supersededBy;
  const reason = parsed.value.supersessionReason === undefined ? ok<string | undefined>(undefined) : boundedText(parsed.value.supersessionReason, `${path}.supersessionReason`, DOMAIN_REASON_MAX); if (!reason.ok) return reason;
  if (status.value === 'resolved' && !canonicalId.value) return fail('invalid_alias_state', 'Resolved aliases require a canonical ID.', `${path}.canonicalId`);
  if (status.value === 'superseded' && (!previous.value || !supersededBy.value || !reason.value)) return fail('invalid_alias_state', 'Superseded aliases preserve previous mapping, successor reference and reason.', path);
  if (status.value !== 'superseded' && (previous.value || supersededBy.value || reason.value)) return fail('invalid_alias_state', 'Supersession fields are valid only for superseded aliases.', path);
  return ok({ contractVersion: 'provider-alias-v1', aliasRef: aliasRef.value, entityType: entityType.value, sourceId: sourceId.value,
    providerRef: providerRef.value, externalKey: externalKey.value, ...(canonicalId.value ? { canonicalId: canonicalId.value } : {}),
    ...(sportId.value ? { sportId: sportId.value } : {}), ...(competitionId.value ? { competitionId: competitionId.value } : {}),
    ...(eventStartAt.value ? { eventStartAt: eventStartAt.value } : {}), effectiveFrom: from.value.canonical, ...(to.value ? { effectiveTo: to.value } : {}),
    status: status.value, evidenceRefs: evidenceRefs.value, version: version.value, ...(previous.value ? { previousCanonicalId: previous.value } : {}),
    ...(supersededBy.value ? { supersededByAliasRef: supersededBy.value } : {}), ...(reason.value ? { supersessionReason: reason.value } : {}) });
}

function candidate(value: JsonValue, path: string): DomainResult<AliasCandidate> {
  const parsed = record(value, path); if (!parsed.ok) return parsed;
  const exact = shape(parsed.value, ['candidateRef', 'canonicalId', 'entityType', 'sourceId', 'providerRef', 'externalKey', 'sportId', 'competitionId', 'eventStartAt', 'evidenceRefs', 'evidenceKind'], path); if (!exact.ok) return exact;
  const candidateRef = reference(parsed.value.candidateRef, `${path}.candidateRef`); if (!candidateRef.ok) return candidateRef;
  const canonicalId = identifier(parsed.value.canonicalId, `${path}.canonicalId`); if (!canonicalId.ok) return canonicalId;
  const entityType = enumValue(parsed.value.entityType, ['sport', 'competition', 'participant', 'event'], `${path}.entityType`); if (!entityType.ok) return entityType;
  const sourceId = identifier(parsed.value.sourceId, `${path}.sourceId`); if (!sourceId.ok) return sourceId;
  const providerRef = reference(parsed.value.providerRef, `${path}.providerRef`); if (!providerRef.ok) return providerRef;
  const externalKey = reference(parsed.value.externalKey, `${path}.externalKey`); if (!externalKey.ok) return externalKey;
  const sportId = optionalId(parsed.value.sportId, `${path}.sportId`); if (!sportId.ok) return sportId;
  const competitionId = optionalId(parsed.value.competitionId, `${path}.competitionId`); if (!competitionId.ok) return competitionId;
  const eventStartAt = optionalTime(parsed.value.eventStartAt, `${path}.eventStartAt`); if (!eventStartAt.ok) return eventStartAt;
  const evidenceRefs = stringArray(parsed.value.evidenceRefs, `${path}.evidenceRefs`, MAX_EVIDENCE_REFS); if (!evidenceRefs.ok) return evidenceRefs;
  const evidenceKind = enumValue(parsed.value.evidenceKind, ['exact_source_key', 'display_name_similarity'], `${path}.evidenceKind`); if (!evidenceKind.ok) return evidenceKind;
  return ok({ candidateRef: candidateRef.value, canonicalId: canonicalId.value, entityType: entityType.value, sourceId: sourceId.value,
    providerRef: providerRef.value, externalKey: externalKey.value, ...(sportId.value ? { sportId: sportId.value } : {}),
    ...(competitionId.value ? { competitionId: competitionId.value } : {}), ...(eventStartAt.value ? { eventStartAt: eventStartAt.value } : {}),
    evidenceRefs: evidenceRefs.value, evidenceKind: evidenceKind.value });
}

export function resolveProviderAlias(input: unknown): DomainResult<AliasResolution> {
  const safe = snapshot(input); if (!safe.ok) return safe;
  const root = record(safe.value, '$'); if (!root.ok) return root;
  const exact = shape(root.value, ['alias', 'candidates', 'asOf', 'policy'], '$'); if (!exact.ok) return exact;
  const alias = parseAlias(root.value.alias); if (!alias.ok) return alias;
  const asOf = timestamp(root.value.asOf, '$.asOf'); if (!asOf.ok) return asOf;
  if (!isRecord(root.value.policy) || root.value.policy.id !== ALIAS_RESOLUTION_POLICY.id || root.value.policy.version !== ALIAS_RESOLUTION_POLICY.version || Object.keys(root.value.policy).length !== 2)
    return fail('unsupported_policy', 'Only exact-evidence-only policy version 1 is supported.', '$.policy');
  if (asOf.value.milliseconds < Date.parse(alias.value.effectiveFrom) || (alias.value.effectiveTo && asOf.value.milliseconds >= Date.parse(alias.value.effectiveTo)))
    return fail('alias_not_effective', 'Alias is not effective at the supplied as-of time.', '$.asOf', { entityRef: alias.value.aliasRef });
  if (alias.value.status === 'superseded') return ok({ contractVersion: 'alias-resolution-v1', status: 'superseded', alias: alias.value,
    policy: ALIAS_RESOLUTION_POLICY, reason: alias.value.supersessionReason!, candidateRefs: [], evidenceRefs: alias.value.evidenceRefs });
  if (!Array.isArray(root.value.candidates)) return fail('invalid_input', 'Candidates must be an array.', '$.candidates');
  if (root.value.candidates.length > MAX_ALIAS_CANDIDATES) return fail('limit_exceeded', 'Alias candidate limit exceeded.', '$.candidates', { metadata: { limit: MAX_ALIAS_CANDIDATES, actual: root.value.candidates.length } });
  const candidates: AliasCandidate[] = []; const refs = new Set<string>(); const ids = new Set<string>();
  for (let index = 0; index < root.value.candidates.length; index += 1) {
    const item = candidate(root.value.candidates[index], `$.candidates[${index}]`); if (!item.ok) return item;
    if (refs.has(item.value.candidateRef) || ids.has(item.value.canonicalId)) return fail('duplicate_candidate', 'Candidate references and canonical IDs must be unique.', `$.candidates[${index}]`, { inputIndex: index, entityRef: item.value.candidateRef });
    refs.add(item.value.candidateRef); ids.add(item.value.canonicalId); candidates.push(item.value);
  }
  const conflicting = candidates.find((item) => item.entityType !== alias.value.entityType || item.sourceId !== alias.value.sourceId
    || item.providerRef !== alias.value.providerRef || item.externalKey !== alias.value.externalKey || item.sportId !== alias.value.sportId
    || item.competitionId !== alias.value.competitionId || item.eventStartAt !== alias.value.eventStartAt);
  if (conflicting) return fail('identity_conflict', 'Candidate conflicts with alias source or canonical context.', '$.candidates', { entityRef: conflicting.candidateRef });
  const exactCandidates = candidates.filter((item) => item.evidenceKind === 'exact_source_key');
  const evidenceRefs = [...new Set([...alias.value.evidenceRefs, ...candidates.flatMap((item) => item.evidenceRefs)])].sort();
  if (exactCandidates.length === 0) return ok({ contractVersion: 'alias-resolution-v1', status: 'unresolved', alias: alias.value,
    policy: ALIAS_RESOLUTION_POLICY, reason: candidates.length ? 'similarity_evidence_cannot_resolve' : 'no_candidate',
    candidateRefs: candidates.map((item) => item.candidateRef).sort(), evidenceRefs });
  if (exactCandidates.length > 1) return ok({ contractVersion: 'alias-resolution-v1', status: 'quarantined', alias: alias.value,
    policy: ALIAS_RESOLUTION_POLICY, reason: 'multiple_exact_candidates', candidateRefs: exactCandidates.map((item) => item.candidateRef).sort(), evidenceRefs });
  if (alias.value.canonicalId && alias.value.canonicalId !== exactCandidates[0].canonicalId)
    return fail('identity_conflict', 'Existing alias mapping conflicts with exact candidate.', '$.alias.canonicalId', { entityRef: alias.value.aliasRef });
  return ok({ contractVersion: 'alias-resolution-v1', status: 'resolved', alias: alias.value, policy: ALIAS_RESOLUTION_POLICY,
    reason: 'single_exact_evidence_backed_candidate', canonicalId: exactCandidates[0].canonicalId,
    candidateRefs: [exactCandidates[0].candidateRef], evidenceRefs });
}

export type { DomainError, DomainResult };
