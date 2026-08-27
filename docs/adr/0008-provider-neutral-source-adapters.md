# ADR-0008: Provider-neutral, permission-gated source adapters

Status: accepted for intelligence architecture (2026-08-28)

## Context

Provider availability, data rights, timestamp quality, historical depth and acquisition methods are unresolved. The architecture must support evidence work without assuming that scraping or redistribution is permitted.

## Decision

Use a provider-neutral adapter contract that transports source envelopes and emits canonical candidates with source, schema, terms, adapter, observation/receipt/effective times and payload hash. Identity resolution, de-vig, features, forecasting, recommendation and settlement remain outside adapters. Manual/sample imports use the same contract. No adapter is activated until acquisition and retention rights, jurisdiction/product review and operational terms are recorded.

## Consequences

- Initial work can use authorised manual/synthetic fixtures without selecting a paid provider.
- Source replacement is bounded by a canonical contract, though provider-specific semantics still need explicit mappings.
- Ambiguous records are quarantined rather than guessed.
- Raw retention may vary; declared replay limitations and permitted canonical provenance remain mandatory.

## Alternatives considered

- Design around one provider payload: rejected because it couples the domain and prejudges procurement.
- Scrape public pages by default: rejected because public visibility does not establish contractual/legal permission or technical stability.
