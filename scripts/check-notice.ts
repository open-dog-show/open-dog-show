// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Approved SPDX licence identifiers ───────────────────────────────────────

const APPROVED_LICENCES: ReadonlySet<string> = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'Unlicense',
  'CC0-1.0',
  'BlueOak-1.0.0',
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PackageJson {
  name?: string;
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

// ─── Pure functions (exported for testing) ────────────────────────────────────

/** Returns true when the package name belongs to the @ods/ scope. */
export function isScopedToOds(name: string): boolean {
  return name.startsWith('@ods/');
}

/**
 * Collects every direct dependency in a package.json that is not an internal
 * @ods/ workspace package.
 */
export function collectDeps(pkgJson: PackageJson): string[] {
  const merged: Record<string, string> = {
    ...pkgJson.dependencies,
    ...pkgJson.devDependencies,
  };
  return Object.keys(merged).filter((name) => !isScopedToOds(name));
}

/**
 * Returns the subset of `deps` whose names do not appear anywhere in the
 * NOTICE text as a plain substring.
 */
export function findMissingFromNotice(notice: string, deps: string[]): string[] {
  return deps.filter((dep) => !notice.includes(dep));
}

/** Returns true when `licence` is on the project's approved-SPDX list. */
export function isApprovedLicence(licence: string): boolean {
  return APPROVED_LICENCES.has(licence);
}

// ─── Impure helpers ───────────────────────────────────────────────────────────

function resolveLicence(packageName: string, rootDir: string): string | null {
  const pkgPath = join(rootDir, 'node_modules', packageName, 'package.json');
  if (!existsSync(pkgPath)) return null;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as PackageJson;
  return pkg.license ?? null;
}

function findWorkspacePackageJsons(rootDir: string): string[] {
  const paths: string[] = [join(rootDir, 'package.json')];
  for (const dir of ['packages', 'apps']) {
    const fullDir = join(rootDir, dir);
    if (!existsSync(fullDir)) continue;
    for (const entry of readdirSync(fullDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(fullDir, entry.name, 'package.json');
      if (existsSync(pkgPath)) paths.push(pkgPath);
    }
  }
  return paths;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function run(): void {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const rootDir = join(scriptDir, '..');
  const noticePath = join(rootDir, 'NOTICE');
  const notice = readFileSync(noticePath, 'utf8');

  const packageJsonPaths = findWorkspacePackageJsons(rootDir);
  const allDeps = new Set<string>();
  for (const pkgPath of packageJsonPaths) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as PackageJson;
    for (const dep of collectDeps(pkg)) {
      allDeps.add(dep);
    }
  }

  let failed = false;

  const missing = findMissingFromNotice(notice, [...allDeps]);
  for (const pkg of missing) {
    console.error(`[NOTICE] missing entry for: ${pkg}`);
    failed = true;
  }

  for (const dep of allDeps) {
    const licence = resolveLicence(dep, rootDir);
    if (licence === null || !isApprovedLicence(licence)) {
      const label = licence === null ? '(could not resolve)' : licence;
      console.error(`[LICENCE] non-approved licence for ${dep}: ${label}`);
      failed = true;
    }
  }

  if (failed) process.exit(1);
}

// Only execute when run directly, not when imported by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) run();
