import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TAGLINE } from './tagline';

describe('tagline', () => {
  it('is mirrored verbatim in the README (single source of truth)', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    expect(readme).toContain(TAGLINE);
  });
});
