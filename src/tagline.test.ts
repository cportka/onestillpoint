import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TAGLINE } from './tagline';

describe('tagline', () => {
  it('has every part mirrored in the README (single source of truth)', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    // The README frames the hero with the tagline (parts above and below, like the
    // About dialog), so assert each ' · '-separated part is present rather than the
    // whole contiguous string.
    for (const part of TAGLINE.split(' · ')) {
      expect(readme).toContain(part);
    }
  });
});
