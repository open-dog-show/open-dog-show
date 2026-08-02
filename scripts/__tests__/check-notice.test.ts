// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
  isScopedToOds,
  collectDeps,
  findMissingFromNotice,
  isApprovedLicence,
} from '../check-notice.js';

describe('isScopedToOds', () => {
  it('returns true for @ods/-scoped packages', () => {
    expect(isScopedToOds('@ods/kernel')).toBe(true);
  });

  it('returns true for any @ods/ sub-package', () => {
    expect(isScopedToOds('@ods/test-kit')).toBe(true);
  });

  it('returns false for unscoped packages', () => {
    expect(isScopedToOds('vitest')).toBe(false);
  });

  it('returns false for packages scoped to another org', () => {
    expect(isScopedToOds('@types/node')).toBe(false);
  });
});

describe('collectDeps', () => {
  it('collects devDependencies, excluding @ods/ packages', () => {
    const pkg = {
      devDependencies: { vitest: '^3', '@ods/kernel': 'workspace:*' },
    };
    expect(collectDeps(pkg)).toEqual(['vitest']);
  });

  it('collects dependencies, excluding @ods/ packages', () => {
    const pkg = {
      dependencies: { pg: '^8', '@ods/test-kit': 'workspace:*' },
    };
    expect(collectDeps(pkg)).toEqual(['pg']);
  });

  it('merges dependencies and devDependencies', () => {
    const pkg = {
      dependencies: { pg: '^8' },
      devDependencies: { vitest: '^3' },
    };
    expect(collectDeps(pkg)).toEqual(expect.arrayContaining(['pg', 'vitest']));
    expect(collectDeps(pkg)).toHaveLength(2);
  });

  it('returns empty array when no dependencies exist', () => {
    expect(collectDeps({})).toEqual([]);
  });
});

describe('findMissingFromNotice', () => {
  it('returns empty array when every dep appears in NOTICE', () => {
    const notice = 'vitest — https://github.com/vitest-dev/vitest\nCopyright 2021';
    expect(findMissingFromNotice(notice, ['vitest'])).toEqual([]);
  });

  it('returns packages that do not appear in NOTICE', () => {
    const notice = 'vitest — https://github.com/vitest-dev/vitest';
    expect(findMissingFromNotice(notice, ['vitest', 'missing-pkg'])).toEqual(['missing-pkg']);
  });

  it('returns all deps when NOTICE is empty', () => {
    expect(findMissingFromNotice('', ['vitest', 'typescript'])).toEqual(['vitest', 'typescript']);
  });
});

describe('isApprovedLicence', () => {
  it.each([
    'MIT',
    'Apache-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'ISC',
    '0BSD',
    'Unlicense',
    'CC0-1.0',
    'BlueOak-1.0.0',
  ])('returns true for approved licence %s', (licence) => {
    expect(isApprovedLicence(licence)).toBe(true);
  });

  it('returns false for GPL-2.0', () => {
    expect(isApprovedLicence('GPL-2.0')).toBe(false);
  });

  it('returns false for LGPL-2.1', () => {
    expect(isApprovedLicence('LGPL-2.1')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isApprovedLicence('')).toBe(false);
  });
});
