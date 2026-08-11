import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cedict from 'cc-cedict';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(projectRoot, 'public', 'cedict-compact.json');
const chineseWord = /^\p{Script=Han}{1,8}$/u;
const definitionBuckets = new Map();

function cleanDefinitions(rawMeaning) {
  return (Array.isArray(rawMeaning) ? rawMeaning : [rawMeaning])
    .flatMap((meaning) => String(meaning ?? '').split(';'))
    .map((meaning) => meaning.trim())
    .filter((meaning) => meaning && !meaning.startsWith('CL:'));
}

for (const rawEntry of cedict.data.all) {
  const definitions = cleanDefinitions(rawEntry[3]);
  if (!definitions.length) continue;

  // Both scripts are included so simplified and traditional text work offline.
  for (const word of new Set([rawEntry[0], rawEntry[1]])) {
    if (!chineseWord.test(word)) continue;
    const bucket = definitionBuckets.get(word) ?? new Set();
    for (const definition of definitions) bucket.add(definition);
    definitionBuckets.set(word, bucket);
  }
}

const entries = Object.fromEntries(
  [...definitionBuckets].map(([word, definitions]) => [word, [...definitions].join('; ')]),
);

if (Object.keys(entries).length < 100_000 || !entries['情况'] || !entries['情況']) {
  throw new Error('Compact dictionary validation failed.');
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(entries));
console.log(`Wrote ${Object.keys(entries).length.toLocaleString()} entries to ${outputPath}`);
