import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERSION } from './version';

// The repo-native form of the Portka standard's enforced version triplet: the
// source of truth is package.json, mirrored by src/version.ts (shown in the UI)
// and documented in CHANGELOG.md. CI runs this on every PR so they can't drift.
const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('version sync (SemVer triplet)', () => {
  it('VERSION is a valid SemVer string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+([-+][0-9A-Za-z.]+)?$/);
  });

  it('src/version.ts matches package.json', () => {
    const pkg = JSON.parse(read('../package.json')) as { version: string };
    expect(pkg.version).toBe(VERSION);
  });

  it('CHANGELOG.md documents the current version', () => {
    // The repo lists releases as bold bullets, e.g. "- **0.22.1** — …".
    expect(read('../CHANGELOG.md')).toContain(`**${VERSION}**`);
  });
});
