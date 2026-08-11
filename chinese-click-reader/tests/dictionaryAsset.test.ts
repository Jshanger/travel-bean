import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('offline dictionary asset', () => {
  it('contains broad simplified and traditional meaning coverage', async () => {
    const assetUrl = new URL('../public/cedict-compact.json', import.meta.url);
    const dictionary = JSON.parse(await readFile(assetUrl, 'utf8')) as Record<string, string>;

    expect(Object.keys(dictionary).length).toBeGreaterThan(190_000);
    expect(dictionary['情况']).toContain('situation');
    expect(dictionary['情況']).toContain('situation');
    expect(dictionary['房东']).toBe('landlord');
    expect(dictionary['旻']).toBe('heaven');
  });
});
