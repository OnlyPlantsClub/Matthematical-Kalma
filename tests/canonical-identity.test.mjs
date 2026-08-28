import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  ALIAS_RESOLUTION_POLICY, CANONICAL_IDENTITY_CONTRACT_VERSION, MAX_ALIAS_CANDIDATES,
  normalizeCanonicalIdentity, resolveProviderAlias,
} from '../src/domain/intelligence/canonical-identity.ts';
import { DEDUPLICATION_POLICY, MAX_OBSERVATION_FACTS, classifyObservation } from '../src/domain/intelligence/observation-deduplication.ts';
import { PAYLOAD_HASH_POLICY, verifyPayloadHash } from '../src/domain/intelligence/payload-hash.ts';

const at = '2026-08-28T01:00:00.000Z';
const later = '2026-08-28T01:01:00.000Z';
const hash = (byte) => `sha256:${byte.repeat(64)}`;
const value = (result) => { assert.equal(result.ok, true, result.ok ? undefined : `${result.error.code}: ${result.error.path}`); return result.value; };
const error = (result, code, path) => { assert.equal(result.ok, false); assert.equal(result.error.code, code); if (path) assert.equal(result.error.path, path); return result.error; };

function identity(overrides = {}) {
  return { contractVersion: CANONICAL_IDENTITY_CONTRACT_VERSION, entityType: 'event', canonicalId: 'evt_01HXOpaque', version: 'identity-policy/1',
    evidenceRefs: ['evidence/event/1'], sportId: 'sport_afl', competitionId: 'competition_afl_mens', eventStartAt: later,
    participants: [
      { participantId: 'participant_home', role: 'home', roleVersion: 'role/1', evidenceRefs: ['evidence/home'] },
      { participantId: 'participant_away', role: 'away', roleVersion: 'role/1', evidenceRefs: ['evidence/away'] },
    ], ...overrides };
}
function alias(overrides = {}) {
  return { contractVersion: 'provider-alias-v1', aliasRef: 'alias/provider/event-77', entityType: 'event', sourceId: 'source_a', providerRef: 'provider/a',
    externalKey: 'event/77', sportId: 'sport_afl', competitionId: 'competition_afl_mens', eventStartAt: later,
    effectiveFrom: at, status: 'unresolved', evidenceRefs: ['evidence/source-row/77'], version: 'alias-policy/1', ...overrides };
}
function candidate(id = 'evt_01HXOpaque', overrides = {}) {
  return { candidateRef: `candidate/${id}`, canonicalId: id, entityType: 'event', sourceId: 'source_a', providerRef: 'provider/a', externalKey: 'event/77',
    sportId: 'sport_afl', competitionId: 'competition_afl_mens', eventStartAt: later, evidenceRefs: [`evidence/${id}`], evidenceKind: 'exact_source_key', ...overrides };
}
function resolution(aliasValue = alias(), candidates = [candidate()], asOf = at) {
  return { alias: aliasValue, candidates, asOf, policy: ALIAS_RESOLUTION_POLICY };
}

test('canonical IDs are stable opaque inputs and event roles are recursively immutable', () => {
  const first = value(normalizeCanonicalIdentity(identity()));
  const renamedDisplayEvidence = value(normalizeCanonicalIdentity(identity({ evidenceRefs: ['evidence/renamed-display'] })));
  assert.equal(first.canonicalId, renamedDisplayEvidence.canonicalId);
  assert.equal(first.canonicalId.includes('home'), false);
  assert.ok(Object.isFrozen(first)); assert.ok(Object.isFrozen(first.participants)); assert.ok(Object.isFrozen(first.participants[0].evidenceRefs));
  assert.throws(() => first.participants.push({}), TypeError);
  for (const entity of [
    { contractVersion: CANONICAL_IDENTITY_CONTRACT_VERSION, entityType: 'sport', canonicalId: 'sport_01', version: '1', evidenceRefs: ['e/1'] },
    { contractVersion: CANONICAL_IDENTITY_CONTRACT_VERSION, entityType: 'competition', canonicalId: 'comp_01', version: '1', evidenceRefs: ['e/1'], sportId: 'sport_01' },
    { contractVersion: CANONICAL_IDENTITY_CONTRACT_VERSION, entityType: 'participant', canonicalId: 'part_01', version: '1', evidenceRefs: ['e/1'], sportId: 'sport_01', competitionId: 'comp_01' },
  ]) assert.equal(normalizeCanonicalIdentity(entity).ok, true);
});

test('exact aliases resolve, unknown/similarity-only aliases do not, and replay is deterministic', () => {
  const resolved = value(resolveProviderAlias(resolution()));
  assert.equal(resolved.status, 'resolved'); assert.equal(resolved.canonicalId, 'evt_01HXOpaque');
  assert.deepEqual(resolveProviderAlias(resolution()), resolveProviderAlias(resolution()));
  assert.equal(value(resolveProviderAlias(resolution(alias(), []))).status, 'unresolved');
  const similarity = value(resolveProviderAlias(resolution(alias(), [candidate('evt_similar', { evidenceKind: 'display_name_similarity' })])));
  assert.equal(similarity.status, 'unresolved'); assert.equal(similarity.reason, 'similarity_evidence_cannot_resolve');
});

test('multiple exact candidates quarantine without a winner; duplicates and conflicts fail closed', () => {
  const ambiguous = value(resolveProviderAlias(resolution(alias(), [candidate('evt_a'), candidate('evt_b')])));
  assert.equal(ambiguous.status, 'quarantined'); assert.equal('canonicalId' in ambiguous, false); assert.deepEqual(ambiguous.candidateRefs, ['candidate/evt_a', 'candidate/evt_b']);
  error(resolveProviderAlias(resolution(alias(), [candidate(), candidate('evt_other', { candidateRef: 'candidate/evt_01HXOpaque' })])), 'duplicate_candidate');
  error(resolveProviderAlias(resolution(alias(), [candidate('evt_x', { sportId: 'sport_boxing' })])), 'identity_conflict');
  error(resolveProviderAlias(resolution(alias({ canonicalId: 'evt_old', status: 'resolved' }), [candidate('evt_new')])), 'identity_conflict');
});

test('effective boundaries are inclusive at start, exclusive at end, and supersession preserves history', () => {
  const ranged = alias({ effectiveTo: later });
  assert.equal(resolveProviderAlias(resolution(ranged, [candidate()], at)).ok, true);
  error(resolveProviderAlias(resolution(ranged, [candidate()], later)), 'alias_not_effective', '$.asOf');
  const superseded = alias({ status: 'superseded', previousCanonicalId: 'evt_old', supersededByAliasRef: 'alias/provider/event-78', supersessionReason: 'provider_rekeyed_event' });
  const result = value(resolveProviderAlias(resolution(superseded, [], at)));
  assert.equal(result.status, 'superseded'); assert.equal(result.alias.previousCanonicalId, 'evt_old'); assert.equal(result.reason, 'provider_rekeyed_event');
});

function fact(ref, overrides = {}) {
  return { contractVersion: 'observation-fact-v1', observationRef: ref, sourceEnvelopeRef: `envelope/${ref}`, sourceId: 'source_a', providerRef: 'provider/a',
    eventId: 'event_1', marketId: 'market_h2h', identityVersion: 'identity/1', payloadHash: hash('a'), observedAt: at, receivedAt: at, ...overrides };
}
const classify = (incoming, existing = []) => classifyObservation({ incoming, existing, policy: DEDUPLICATION_POLICY });

test('observations classify new and exact duplicates idempotently', () => {
  assert.equal(value(classify(fact('obs/new'))).classification, 'new');
  const original = fact('obs/1');
  assert.equal(value(classify({ ...original }, [original])).classification, 'exact_duplicate');
  assert.equal(value(classify(fact('obs/reimport'), [original])).classification, 'exact_duplicate');
  assert.deepEqual(classify(fact('obs/reimport'), [original]), classify(fact('obs/reimport'), [original]));
});

test('valid corrections are append-only and record deterministic ordering disagreements', () => {
  const parent = fact('obs/1', { sourceSequence: '10' });
  const correction = fact('obs/2', { payloadHash: hash('b'), correctsObservationRef: 'obs/1', sourceSequence: '11', observedAt: '2026-08-28T00:59:00.000Z' });
  const result = value(classify(correction, [parent]));
  assert.equal(result.classification, 'correction'); assert.deepEqual(result.correctionChain, ['obs/2', 'obs/1']);
  assert.equal(result.ordering.primaryKey, 'source_sequence'); assert.equal(result.ordering.sequenceTimestampDisagreement, true);
  assert.equal(parent.payloadHash, hash('a'));
});

test('correction chains reject missing parents, cycles, cross-scope links and already-superseded parents', () => {
  error(classify(fact('obs/2', { payloadHash: hash('b'), correctsObservationRef: 'obs/missing' })), 'missing_parent');
  const a = fact('obs/a', { payloadHash: hash('b'), correctsObservationRef: 'obs/b' });
  const b = fact('obs/b', { payloadHash: hash('c'), correctsObservationRef: 'obs/a' });
  error(classify(fact('obs/incoming'), [a, b]), 'correction_cycle');
  error(classify(fact('obs/incoming'), [fact('obs/1'), fact('obs/2', { payloadHash: hash('b'), correctsObservationRef: 'obs/1', marketId: 'market_line' })]), 'correction_scope_conflict');
  for (const override of [{ sourceId: 'source_b' }, { eventId: 'event_2' }, { marketId: 'market_line' }, { providerRef: 'provider/b' }]) {
    const result = value(classify(fact('obs/2', { payloadHash: hash('b'), correctsObservationRef: 'obs/1', ...override }), [fact('obs/1')]));
    assert.equal(result.classification, 'conflict');
  }
  const corrected = fact('obs/2', { payloadHash: hash('b'), correctsObservationRef: 'obs/1' });
  assert.equal(value(classify(fact('obs/3', { payloadHash: hash('c'), correctsObservationRef: 'obs/1' }), [fact('obs/1'), corrected])).classification, 'already_superseded');
});

test('equal hashes with conflicting metadata conflict and different hashes are not implicit corrections', () => {
  assert.equal(value(classify(fact('obs/2', { eventId: 'event_2' }), [fact('obs/1')])).classification, 'conflict');
  assert.equal(value(classify(fact('obs/2', { payloadHash: hash('b') }), [fact('obs/1')])).classification, 'new');
});

test('SHA-256 verifies known empty and UTF-8 vectors and reports mismatches', async () => {
  const empty = await verifyPayloadHash({ payloadHash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', replayMode: 'full_payload_retained' }, new Uint8Array());
  assert.equal(value(empty).status, 'verified');
  const utf8 = await verifyPayloadHash({ payloadHash: 'sha256:4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c', replayMode: 'hash_only_verification' }, 'é');
  assert.equal(value(utf8).status, 'verified'); assert.equal(value(utf8).payloadByteLength, 2); assert.equal(value(utf8).payloadKind, 'utf8_string');
  assert.equal(value(await verifyPayloadHash({ payloadHash: hash('0'), replayMode: 'full_payload_retained' }, new Uint8Array())).status, 'mismatch');
});

test('payload limit accepts exact maximum and rejects one byte over before hashing', async () => {
  const maximum = new Uint8Array(PAYLOAD_HASH_POLICY.maxPayloadBytes);
  const expected = `sha256:${createHash('sha256').update(maximum).digest('hex')}`;
  assert.equal(value(await verifyPayloadHash({ payloadHash: expected, replayMode: 'full_payload_retained' }, maximum)).status, 'verified');
  const oversized = new Uint8Array(PAYLOAD_HASH_POLICY.maxPayloadBytes + 1);
  error(await verifyPayloadHash({ payloadHash: expected, replayMode: 'full_payload_retained' }, oversized), 'payload_too_large', '$payload');
});

test('missing bytes are explicitly not verifiable for every retention mode', async () => {
  for (const replayMode of ['full_payload_retained', 'hash_and_retrievable_locator', 'hash_only_verification', 'not_fully_replayable']) {
    const result = value(await verifyPayloadHash({ payloadHash: hash('0'), replayMode }));
    assert.equal(result.status, 'not_verifiable');
  }
});

test('all boundaries contain malformed JavaScript, hostile getters/proxies, limits and unknown credentials', async () => {
  const getter = {}; Object.defineProperty(getter, 'contractVersion', { enumerable: true, get() { throw new Error('secret'); } });
  error(normalizeCanonicalIdentity(getter), 'invalid_input');
  error(resolveProviderAlias(new Proxy({}, { ownKeys() { throw new Error('secret'); } })), 'invalid_input');
  error(classifyObservation(new Proxy({}, { getPrototypeOf() { throw new Error('secret'); } })), 'invalid_input');
  error(normalizeCanonicalIdentity({ ...identity(), API_KEY: 'must-not-leak' }), 'credential_field');
  error(normalizeCanonicalIdentity(identity({ canonicalId: 'x'.repeat(129) })), 'invalid_identifier');
  error(resolveProviderAlias(resolution(alias(), Array.from({ length: MAX_ALIAS_CANDIDATES + 1 }, (_, index) => candidate(`evt_${index}`)))), 'limit_exceeded');
  error(classify(fact('obs/new'), Array.from({ length: MAX_OBSERVATION_FACTS + 1 }, (_, index) => fact(`obs/${index}`, { payloadHash: `sha256:${index.toString(16).padStart(64, '0')}` }))), 'limit_exceeded');
  const hostileBytes = new Proxy(new Uint8Array([1]), { getPrototypeOf() { throw new Error('secret'); } });
  error(await verifyPayloadHash({ payloadHash: hash('0'), replayMode: 'full_payload_retained' }, hostileBytes), 'invalid_payload');
});

test('public decisions and errors are recursively frozen and use no clock, randomness or network', () => {
  const result = resolveProviderAlias(resolution()); assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.value)); assert.ok(Object.isFrozen(result.value.policy));
  const failed = classifyObservation({}); assert.ok(Object.isFrozen(failed)); assert.ok(Object.isFrozen(failed.error));
  const originalNow = Date.now; const originalRandom = Math.random; Date.now = () => { throw new Error('clock'); }; Math.random = () => { throw new Error('random'); };
  try { assert.equal(resolveProviderAlias(resolution()).ok, true); assert.equal(classify(fact('obs/new')).ok, true); }
  finally { Date.now = originalNow; Math.random = originalRandom; }
});
