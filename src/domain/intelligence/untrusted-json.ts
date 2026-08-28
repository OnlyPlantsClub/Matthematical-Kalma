export const UNTRUSTED_INSPECTION_LIMITS = Object.freeze({
  version: 'untrusted-json-inspection-v2',
  maxContainerNodes: 128,
  maxPropertiesAndEntries: 512,
  maxCumulativeStringCodeUnits: 16_384,
  maxDepth: 8,
  maxObjectKeys: 64,
  maxArrayLength: 17,
  maxIndividualStringCodeUnits: 1_024,
} as const);

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonRecord | readonly JsonValue[];
export type JsonRecord = Readonly<{ [key: string]: JsonValue }>;

export type InspectionErrorCode =
  | 'invalid_input'
  | 'unknown_field'
  | 'credential_field'
  | 'inspection_limit_exceeded'
  | 'repeated_reference'
  | 'market_limit_exceeded';

export interface InspectionUsage {
  readonly containerNodes: number;
  readonly propertiesAndEntries: number;
  readonly cumulativeStringCodeUnits: number;
}

export interface InspectionError {
  readonly code: InspectionErrorCode;
  readonly message: string;
  readonly path: string;
  readonly inputIndex?: number;
  readonly metadata?: Readonly<{
    readonly limitName?: keyof Omit<typeof UNTRUSTED_INSPECTION_LIMITS, 'version'>;
    readonly limit?: number;
    readonly actual?: number;
    readonly usage?: InspectionUsage;
  }>;
}

export type InspectionResult =
  | Readonly<{ ok: true; value: Readonly<{ data: JsonValue; usage: InspectionUsage }> }>
  | Readonly<{ ok: false; error: InspectionError }>;

const CREDENTIAL_FIELD_NAMES = new Set([
  'token', 'tokens', 'apikey', 'apikeys', 'accesstoken', 'accesstokens', 'refreshtoken', 'refreshtokens',
  'clientsecret', 'clientsecrets', 'password', 'passwords', 'credential', 'credentials', 'authorization',
  'authorizations', 'authorizationfield', 'authorizationfields', 'authorizationheader', 'authorizationheaders',
  'bearer', 'bearers', 'bearertoken', 'bearertokens', 'bearervalue', 'bearervalues', 'cookie', 'cookies',
  'setcookie', 'setcookies',
]);

interface MutableInspectionBudget {
  containerNodes: number;
  propertiesAndEntries: number;
  cumulativeStringCodeUnits: number;
  seenReferences: WeakSet<object>;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

function usage(budget: MutableInspectionBudget): InspectionUsage {
  return Object.freeze({
    containerNodes: budget.containerNodes,
    propertiesAndEntries: budget.propertiesAndEntries,
    cumulativeStringCodeUnits: budget.cumulativeStringCodeUnits,
  });
}

function failure(code: InspectionErrorCode, message: string, path: string, budget?: MutableInspectionBudget,
  limit?: { name: keyof Omit<typeof UNTRUSTED_INSPECTION_LIMITS, 'version'>; value: number; actual: number }, inputIndex?: number): InspectionResult {
  const metadata = budget === undefined && limit === undefined ? undefined : deepFreeze({
    ...(limit ? { limitName: limit.name, limit: limit.value, actual: limit.actual } : {}),
    ...(budget ? { usage: usage(budget) } : {}),
  });
  const error = deepFreeze({ code, message, path, ...(inputIndex === undefined ? {} : { inputIndex }), ...(metadata ? { metadata } : {}) });
  return Object.freeze({ ok: false, error });
}

function aggregateLimit(budget: MutableInspectionBudget, path: string,
  name: keyof Omit<typeof UNTRUSTED_INSPECTION_LIMITS, 'version'>, actual: number): InspectionResult {
  return failure('inspection_limit_exceeded', 'Aggregate untrusted-input inspection budget was exceeded.', path, budget,
    { name, value: UNTRUSTED_INSPECTION_LIMITS[name], actual });
}

function consumeString(value: string, path: string, budget: MutableInspectionBudget): InspectionResult | undefined {
  if (value.length > UNTRUSTED_INSPECTION_LIMITS.maxIndividualStringCodeUnits) {
    return failure('invalid_input', 'Individual string exceeds the inspection boundary limit.', path, budget);
  }
  budget.cumulativeStringCodeUnits += value.length;
  if (budget.cumulativeStringCodeUnits > UNTRUSTED_INSPECTION_LIMITS.maxCumulativeStringCodeUnits) {
    return aggregateLimit(budget, path, 'maxCumulativeStringCodeUnits', budget.cumulativeStringCodeUnits);
  }
  return undefined;
}

export function normalizeCredentialFieldName(fieldName: string): string {
  return fieldName.replace(/[_\-\s]+/g, '').toLowerCase();
}

export function isCredentialFieldName(fieldName: string): boolean {
  return CREDENTIAL_FIELD_NAMES.has(normalizeCredentialFieldName(fieldName));
}

function inspectValue(input: unknown, path: string, depth: number, budget: MutableInspectionBudget): InspectionResult {
  if (input === null || typeof input === 'boolean') {
    return Object.freeze({ ok: true, value: Object.freeze({ data: input, usage: usage(budget) }) });
  }
  if (typeof input === 'string') {
    const exceeded = consumeString(input, path, budget);
    if (exceeded) return exceeded;
    return Object.freeze({ ok: true, value: Object.freeze({ data: input, usage: usage(budget) }) });
  }
  if (typeof input === 'number') {
    return Number.isFinite(input)
      ? Object.freeze({ ok: true, value: Object.freeze({ data: input, usage: usage(budget) }) })
      : failure('invalid_input', 'Untrusted numeric values must be finite.', path, budget);
  }
  if (typeof input !== 'object' || input === null) {
    return failure('invalid_input', 'Input must contain only bounded JSON-compatible values.', path, budget);
  }
  if (budget.seenReferences.has(input)) {
    return failure('repeated_reference', 'Cycles and repeated object or array references are not valid JSON-compatible input.', path, budget);
  }
  if (depth > UNTRUSTED_INSPECTION_LIMITS.maxDepth) {
    return failure('invalid_input', 'Input exceeds the maximum JSON-compatible nesting depth.', path, budget);
  }
  budget.seenReferences.add(input);
  budget.containerNodes += 1;
  if (budget.containerNodes > UNTRUSTED_INSPECTION_LIMITS.maxContainerNodes) {
    return aggregateLimit(budget, path, 'maxContainerNodes', budget.containerNodes);
  }

  const isArray = Array.isArray(input);
  const keys = Reflect.ownKeys(input);
  const localLimit = isArray ? UNTRUSTED_INSPECTION_LIMITS.maxArrayLength + 1 : UNTRUSTED_INSPECTION_LIMITS.maxObjectKeys;
  const countedKeys = isArray ? Math.max(0, keys.length - 1) : keys.length;
  if (keys.length > localLimit) {
    const limitName = isArray ? 'maxArrayLength' : 'maxObjectKeys';
    const actual = isArray ? countedKeys : keys.length;
    return aggregateLimit(budget, path, limitName, actual);
  }
  const aggregateProperties = budget.propertiesAndEntries + countedKeys;
  if (aggregateProperties > UNTRUSTED_INSPECTION_LIMITS.maxPropertiesAndEntries) {
    budget.propertiesAndEntries = aggregateProperties;
    return aggregateLimit(budget, path, 'maxPropertiesAndEntries', aggregateProperties);
  }
  budget.propertiesAndEntries = aggregateProperties;

  const prototype = Object.getPrototypeOf(input);
  if (isArray) {
    if (prototype !== Array.prototype) return failure('invalid_input', 'Arrays must use the standard Array prototype.', path, budget);
    if (keys.some((key) => typeof key === 'symbol')) return failure('invalid_input', 'Symbol keys are not supported.', path, budget);
    if (!keys.includes('length')) return failure('invalid_input', 'Arrays require an own length property.', `${path}.length`, budget);
    const entryKeys = keys.filter((key) => key !== 'length');
    const unexpected = entryKeys.find((key) => !/^(?:0|[1-9]\d*)$/.test(String(key)));
    if (unexpected !== undefined) {
      const field = String(unexpected);
      return failure(isCredentialFieldName(field) ? 'credential_field' : 'unknown_field',
        isCredentialFieldName(field) ? 'Credential-bearing fields are forbidden at this boundary.' : 'Arrays must not contain named properties.',
        `${path}.${field}`, budget);
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(input, 'length');
    if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, 'value') || !Number.isSafeInteger(lengthDescriptor.value)
      || lengthDescriptor.value < 0 || lengthDescriptor.value > UNTRUSTED_INSPECTION_LIMITS.maxArrayLength) {
      return failure('invalid_input', 'Array length must be a bounded data property.', `${path}.length`, budget);
    }
    const declaredLength = lengthDescriptor.value;
    const entrySet = new Set(entryKeys);
    for (let index = 0; index < declaredLength; index += 1) {
      if (!entrySet.has(String(index))) return failure('invalid_input', 'Arrays must be dense data-only arrays.', `${path}[${index}]`, budget, undefined, index);
    }
    if (entryKeys.length !== declaredLength) return failure('invalid_input', 'Arrays must be dense data-only arrays.', path, budget);
    const clone: JsonValue[] = [];
    for (let index = 0; index < declaredLength; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return failure('invalid_input', 'Arrays must contain only data entries.', `${path}[${index}]`, budget, undefined, index);
      const inspected = inspectValue(descriptor.value, `${path}[${index}]`, depth + 1, budget);
      if (!inspected.ok) return inspected;
      clone.push(inspected.value.data);
    }
    return Object.freeze({ ok: true, value: Object.freeze({ data: Object.freeze(clone), usage: usage(budget) }) });
  }

  if (prototype !== Object.prototype && prototype !== null) return failure('invalid_input', 'Records must be plain JSON-compatible objects.', path, budget);
  for (const key of keys) {
    if (typeof key !== 'string') return failure('invalid_input', 'Symbol keys are not supported.', path, budget);
    const exceeded = consumeString(key, `${path}.${key}`, budget);
    if (exceeded) return exceeded;
    if (isCredentialFieldName(key)) return failure('credential_field', 'Credential-bearing fields are forbidden at this boundary.', `${path}.${key}`, budget);
  }
  const clone: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
  for (const key of keys) {
    if (typeof key !== 'string') return failure('invalid_input', 'Symbol keys are not supported.', path, budget);
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return failure('invalid_input', 'Accessor properties are not supported.', `${path}.${key}`, budget);
    const inspected = inspectValue(descriptor.value, `${path}.${key}`, depth + 1, budget);
    if (!inspected.ok) return inspected;
    clone[key] = inspected.value.data;
  }
  return Object.freeze({ ok: true, value: Object.freeze({ data: deepFreeze(clone), usage: usage(budget) }) });
}

export function inspectJsonCompatibleInput(input: unknown): InspectionResult {
  const budget: MutableInspectionBudget = {
    containerNodes: 0,
    propertiesAndEntries: 0,
    cumulativeStringCodeUnits: 0,
    seenReferences: new WeakSet<object>(),
  };
  try {
    return inspectValue(input, '$', 0, budget);
  } catch {
    return failure('invalid_input', 'Input could not be safely inspected as JSON-compatible data.', '$', budget);
  }
}
