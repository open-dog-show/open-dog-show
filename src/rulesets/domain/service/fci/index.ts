// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * FCI domain-service implementations of the rulesets policy ports.
 *
 * These are pure in-memory domain services (ADR-0001: concrete rulesets are
 * pure domain modules that depend only on the domain core) — not test doubles.
 * They live in the domain layer (`domain/service/fci/`) and are exported from
 * this relative-import barrel, kept separate from `src/rulesets/index.ts` so
 * the main export stays the abstraction surface (the ports + the data model):
 * downstream contexts depend on the *ports*, and the composition root
 * (`apps/api`) will wire the FCI *domain services*. See ADR-0021.
 */
export { FciClassEligibilityPolicy } from './fci-class-eligibility-policy.js';
export { FciAwardPolicy } from './fci-award-policy.js';
export { FciCollectiveAwardPolicy } from './fci-collective-award-policy.js';
