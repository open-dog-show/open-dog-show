// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The rulesets context's re-export of the kernel's {@link Brand} helper, so the
 * generic brand lives in `domain/shared/` (not inside the identifier-brands
 * module) and the non-id value objects (`age-months`, `entry-ref`) consume it
 * from here rather than from `domain-ids`.
 */
export type { Brand } from '../../../Shared/domain/brand.js';
