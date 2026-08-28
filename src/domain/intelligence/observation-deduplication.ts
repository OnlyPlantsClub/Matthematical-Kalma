import type { JsonRecord, JsonValue } from './untrusted-json.ts';
import { SHA256_PATTERN, deepFreeze, fail, identifier, isRecord, ok, record, reference, shape, snapshot, timestamp, type DomainResult } from './domain-validation.ts';

export const DEDUPLICATION_POLICY = Object.freeze({ id: 'append-only-observation-deduplication', version: '1' } as const);
export const MAX_OBSERVATION_FACTS = 16;

export interface ObservationFact {
  readonly contractVersion: 'observation-fact-v1';
  readonly observationRef: string;
  readonly sourceEnvelopeRef: string;
  readonly sourceId: string;
  readonly providerRef: string;
  readonly eventId: string;
  readonly marketId: string;
  readonly identityVersion: string;
  readonly payloadHash: string;
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly sourceSequence?: string;
  readonly correctsObservationRef?: string;
}

export interface OrderingDecision {
  readonly firstObservationRef: string;
  readonly secondObservationRef: string;
  readonly order: 'first_before_second' | 'second_before_first' | 'equal';
  readonly primaryKey: 'source_sequence' | 'observed_at' | 'received_at' | 'observation_ref';
  readonly sequenceTimestampDisagreement: boolean;
  readonly policy: typeof DEDUPLICATION_POLICY;
}

export interface DeduplicationDecision {
  readonly contractVersion: 'observation-deduplication-v1';
  readonly classification: 'new' | 'exact_duplicate' | 'correction' | 'conflict' | 'already_superseded';
  readonly reason: string;
  readonly incomingObservationRef: string;
  readonly parentObservationRef?: string;
  readonly matchedObservationRefs: readonly string[];
  readonly correctionChain: readonly string[];
  readonly ordering?: OrderingDecision;
  readonly policy: typeof DEDUPLICATION_POLICY;
  readonly evidenceRefs: readonly string[];
}

function optionalRef(value: JsonValue | undefined, path: string): DomainResult<string | undefined> {
  return value === undefined ? ok(undefined) : reference(value, path);
}
function fact(value: JsonValue, path: string): DomainResult<ObservationFact> {
  const parsed = record(value, path); if (!parsed.ok) return parsed;
  const exact = shape(parsed.value, ['contractVersion', 'observationRef', 'sourceEnvelopeRef', 'sourceId', 'providerRef', 'eventId', 'marketId', 'identityVersion', 'payloadHash', 'observedAt', 'receivedAt', 'sourceSequence', 'correctsObservationRef'], path); if (!exact.ok) return exact;
  if (parsed.value.contractVersion !== 'observation-fact-v1') return fail('unsupported_version', 'Observation fact version is unsupported.', `${path}.contractVersion`);
  const observationRef = reference(parsed.value.observationRef, `${path}.observationRef`); if (!observationRef.ok) return observationRef;
  const sourceEnvelopeRef = reference(parsed.value.sourceEnvelopeRef, `${path}.sourceEnvelopeRef`); if (!sourceEnvelopeRef.ok) return sourceEnvelopeRef;
  const sourceId = identifier(parsed.value.sourceId, `${path}.sourceId`); if (!sourceId.ok) return sourceId;
  const providerRef = reference(parsed.value.providerRef, `${path}.providerRef`); if (!providerRef.ok) return providerRef;
  const eventId = identifier(parsed.value.eventId, `${path}.eventId`); if (!eventId.ok) return eventId;
  const marketId = identifier(parsed.value.marketId, `${path}.marketId`); if (!marketId.ok) return marketId;
  const identityVersion = reference(parsed.value.identityVersion, `${path}.identityVersion`, 128); if (!identityVersion.ok) return identityVersion;
  if (typeof parsed.value.payloadHash !== 'string' || !SHA256_PATTERN.test(parsed.value.payloadHash)) return fail('invalid_hash', 'Payload hash must be canonical lowercase sha256:<64 hex>.', `${path}.payloadHash`);
  const observedAt = timestamp(parsed.value.observedAt, `${path}.observedAt`); if (!observedAt.ok) return observedAt;
  const receivedAt = timestamp(parsed.value.receivedAt, `${path}.receivedAt`); if (!receivedAt.ok) return receivedAt;
  if (receivedAt.value.milliseconds < observedAt.value.milliseconds) return fail('invalid_time_order', 'Receipt time cannot precede observation time.', `${path}.receivedAt`);
  const sourceSequence = optionalRef(parsed.value.sourceSequence, `${path}.sourceSequence`); if (!sourceSequence.ok) return sourceSequence;
  const corrects = optionalRef(parsed.value.correctsObservationRef, `${path}.correctsObservationRef`); if (!corrects.ok) return corrects;
  if (corrects.value === observationRef.value) return fail('correction_cycle', 'An observation cannot correct itself.', `${path}.correctsObservationRef`, { entityRef: observationRef.value });
  return ok({ contractVersion: 'observation-fact-v1', observationRef: observationRef.value, sourceEnvelopeRef: sourceEnvelopeRef.value,
    sourceId: sourceId.value, providerRef: providerRef.value, eventId: eventId.value, marketId: marketId.value,
    identityVersion: identityVersion.value, payloadHash: parsed.value.payloadHash, observedAt: observedAt.value.canonical,
    receivedAt: receivedAt.value.canonical, ...(sourceSequence.value ? { sourceSequence: sourceSequence.value } : {}),
    ...(corrects.value ? { correctsObservationRef: corrects.value } : {}) });
}

function numericSequence(value: string | undefined): bigint | undefined {
  return value !== undefined && /^(?:0|[1-9]\d{0,38})$/.test(value) ? BigInt(value) : undefined;
}
function sign(value: number | bigint): -1 | 0 | 1 { return value < 0 ? -1 : value > 0 ? 1 : 0; }
function compareText(a: string, b: string): -1 | 0 | 1 { return a < b ? -1 : a > b ? 1 : 0; }

export function compareObservationOrder(first: ObservationFact, second: ObservationFact): OrderingDecision {
  const firstSequence = numericSequence(first.sourceSequence); const secondSequence = numericSequence(second.sourceSequence);
  const observedComparison = compareText(first.observedAt, second.observedAt);
  let comparison: -1 | 0 | 1; let primaryKey: OrderingDecision['primaryKey'];
  if (firstSequence !== undefined && secondSequence !== undefined && firstSequence !== secondSequence) {
    comparison = sign(firstSequence - secondSequence); primaryKey = 'source_sequence';
  } else if (observedComparison !== 0) { comparison = observedComparison; primaryKey = 'observed_at';
  } else { const received = compareText(first.receivedAt, second.receivedAt); if (received !== 0) { comparison = received; primaryKey = 'received_at';
    } else { comparison = compareText(first.observationRef, second.observationRef); primaryKey = 'observation_ref'; } }
  const sequenceComparison = firstSequence !== undefined && secondSequence !== undefined ? sign(firstSequence - secondSequence) : 0;
  return deepFreeze({ firstObservationRef: first.observationRef, secondObservationRef: second.observationRef,
    order: comparison < 0 ? 'first_before_second' : comparison > 0 ? 'second_before_first' : 'equal', primaryKey,
    sequenceTimestampDisagreement: sequenceComparison !== 0 && observedComparison !== 0 && sequenceComparison !== observedComparison,
    policy: DEDUPLICATION_POLICY });
}

function sameIdentity(a: ObservationFact, b: ObservationFact): boolean {
  return a.sourceId === b.sourceId && a.providerRef === b.providerRef && a.eventId === b.eventId && a.marketId === b.marketId && a.identityVersion === b.identityVersion;
}
function sameFact(a: ObservationFact, b: ObservationFact): boolean {
  return sameIdentity(a, b) && a.payloadHash === b.payloadHash && a.observedAt === b.observedAt && a.receivedAt === b.receivedAt
    && a.sourceSequence === b.sourceSequence && a.correctsObservationRef === b.correctsObservationRef;
}
function decision(classification: DeduplicationDecision['classification'], reason: string, incoming: ObservationFact,
  detail: Partial<DeduplicationDecision> = {}): DomainResult<DeduplicationDecision> {
  return ok({ contractVersion: 'observation-deduplication-v1', classification, reason, incomingObservationRef: incoming.observationRef,
    matchedObservationRefs: detail.matchedObservationRefs ?? [], correctionChain: detail.correctionChain ?? [],
    policy: DEDUPLICATION_POLICY, evidenceRefs: detail.evidenceRefs ?? [incoming.sourceEnvelopeRef],
    ...(detail.parentObservationRef ? { parentObservationRef: detail.parentObservationRef } : {}), ...(detail.ordering ? { ordering: detail.ordering } : {}) });
}

export function classifyObservation(input: unknown): DomainResult<DeduplicationDecision> {
  const safe = snapshot(input); if (!safe.ok) return safe;
  const root = record(safe.value, '$'); if (!root.ok) return root;
  const exact = shape(root.value, ['incoming', 'existing', 'policy'], '$'); if (!exact.ok) return exact;
  if (!isPolicy(root.value.policy)) return fail('unsupported_policy', 'Only append-only observation deduplication policy version 1 is supported.', '$.policy');
  const incoming = fact(root.value.incoming, '$.incoming'); if (!incoming.ok) return incoming;
  if (!Array.isArray(root.value.existing)) return fail('invalid_input', 'Existing observations must be an array.', '$.existing');
  if (root.value.existing.length > MAX_OBSERVATION_FACTS) return fail('limit_exceeded', 'Observation fact limit exceeded.', '$.existing', { metadata: { limit: MAX_OBSERVATION_FACTS, actual: root.value.existing.length } });
  const existing: ObservationFact[] = []; const byRef = new Map<string, ObservationFact>();
  for (let index = 0; index < root.value.existing.length; index += 1) {
    const parsed = fact(root.value.existing[index], `$.existing[${index}]`); if (!parsed.ok) return parsed;
    if (byRef.has(parsed.value.observationRef)) return fail('duplicate_reference', 'Existing observation references must be unique.', `$.existing[${index}].observationRef`, { inputIndex: index, entityRef: parsed.value.observationRef });
    byRef.set(parsed.value.observationRef, parsed.value); existing.push(parsed.value);
  }
  const graph = new Map(existing.map((item) => [item.observationRef, item.correctsObservationRef]));
  graph.set(incoming.value.observationRef, incoming.value.correctsObservationRef);
  for (const item of [...existing, incoming.value]) {
    if (item.correctsObservationRef && !graph.has(item.correctsObservationRef)) return fail('missing_parent', 'Correction parent does not exist in the supplied immutable facts.', '$.existing', { entityRef: item.correctsObservationRef });
    if (item !== incoming.value && item.correctsObservationRef) {
      const parent = item.correctsObservationRef === incoming.value.observationRef ? incoming.value : byRef.get(item.correctsObservationRef);
      if (parent && !sameIdentity(parent, item)) return fail('correction_scope_conflict', 'Correction chain crosses source, provider, event, market or identity version.', '$.existing', { entityRef: item.observationRef });
    }
    const seen = new Set<string>(); let cursor: string | undefined = item.observationRef; let length = 0;
    while (cursor !== undefined) { if (seen.has(cursor)) return fail('correction_cycle', 'Correction chain contains a cycle.', '$.existing', { entityRef: cursor }); seen.add(cursor); cursor = graph.get(cursor); length += 1;
      if (length > MAX_OBSERVATION_FACTS + 1) return fail('limit_exceeded', 'Correction chain limit exceeded.', '$.existing'); }
  }
  const sameRef = byRef.get(incoming.value.observationRef);
  if (sameRef) return sameFact(sameRef, incoming.value)
    ? decision('exact_duplicate', 'same_observation_reference_and_fact', incoming.value, { matchedObservationRefs: [sameRef.observationRef], evidenceRefs: [sameRef.sourceEnvelopeRef, incoming.value.sourceEnvelopeRef] })
    : decision('conflict', 'observation_reference_reused_for_different_fact', incoming.value, { matchedObservationRefs: [sameRef.observationRef], evidenceRefs: [sameRef.sourceEnvelopeRef, incoming.value.sourceEnvelopeRef] });
  const hashMatches = existing.filter((item) => item.payloadHash === incoming.value.payloadHash);
  const exactDuplicate = hashMatches.find((item) => sameFact({ ...incoming.value, observationRef: item.observationRef }, item));
  if (exactDuplicate) return decision('exact_duplicate', 'same_payload_and_identity_metadata', incoming.value,
    { matchedObservationRefs: [exactDuplicate.observationRef], evidenceRefs: [exactDuplicate.sourceEnvelopeRef, incoming.value.sourceEnvelopeRef] });
  if (hashMatches.length) return decision('conflict', 'equal_hash_with_conflicting_identity_or_observation_metadata', incoming.value,
    { matchedObservationRefs: hashMatches.map((item) => item.observationRef).sort(), evidenceRefs: [...hashMatches.map((item) => item.sourceEnvelopeRef), incoming.value.sourceEnvelopeRef].sort() });
  const correctedBy = existing.filter((item) => item.correctsObservationRef === incoming.value.observationRef);
  if (correctedBy.length) return decision('already_superseded', 'incoming_fact_is_already_superseded', incoming.value,
    { matchedObservationRefs: correctedBy.map((item) => item.observationRef).sort(), evidenceRefs: [...correctedBy.map((item) => item.sourceEnvelopeRef), incoming.value.sourceEnvelopeRef].sort() });
  if (!incoming.value.correctsObservationRef) return decision('new', 'no_duplicate_or_explicit_correction_parent', incoming.value);
  const parent = byRef.get(incoming.value.correctsObservationRef)!;
  if (!sameIdentity(parent, incoming.value)) return decision('conflict', 'correction_crosses_source_event_market_or_identity_version', incoming.value,
    { parentObservationRef: parent.observationRef, matchedObservationRefs: [parent.observationRef], evidenceRefs: [parent.sourceEnvelopeRef, incoming.value.sourceEnvelopeRef] });
  if (parent.payloadHash === incoming.value.payloadHash) return decision('conflict', 'correction_does_not_change_payload', incoming.value,
    { parentObservationRef: parent.observationRef, matchedObservationRefs: [parent.observationRef], evidenceRefs: [parent.sourceEnvelopeRef, incoming.value.sourceEnvelopeRef] });
  const children = existing.filter((item) => item.correctsObservationRef === parent.observationRef);
  if (children.length) return decision('already_superseded', 'correction_parent_is_already_superseded', incoming.value,
    { parentObservationRef: parent.observationRef, matchedObservationRefs: children.map((item) => item.observationRef).sort(), evidenceRefs: [...children.map((item) => item.sourceEnvelopeRef), incoming.value.sourceEnvelopeRef].sort() });
  const chain: string[] = [incoming.value.observationRef]; let cursor: ObservationFact | undefined = parent;
  while (cursor) { chain.push(cursor.observationRef); cursor = cursor.correctsObservationRef ? byRef.get(cursor.correctsObservationRef) : undefined; }
  const ordering = compareObservationOrder(parent, incoming.value);
  return decision('correction', 'explicit_valid_append_only_correction', incoming.value, { parentObservationRef: parent.observationRef,
    matchedObservationRefs: [parent.observationRef], correctionChain: chain, ordering,
    evidenceRefs: [...chain.map((ref) => (ref === incoming.value.observationRef ? incoming.value : byRef.get(ref)!).sourceEnvelopeRef)] });
}

function isPolicy(value: JsonValue | undefined): value is JsonRecord {
  return isRecord(value) && Object.keys(value).length === 2
    && value.id === DEDUPLICATION_POLICY.id && value.version === DEDUPLICATION_POLICY.version;
}
