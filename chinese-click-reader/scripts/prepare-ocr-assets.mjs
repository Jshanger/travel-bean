import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const coreFiles = [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
];

const coreDestination = resolve('public/ocr/core');
const languageDestination = resolve('public/ocr/lang');
await Promise.all([
  mkdir(coreDestination, { recursive: true }),
  mkdir(languageDestination, { recursive: true }),
]);

await Promise.all([
  ...coreFiles.map(fileName => copyFile(
    resolve('node_modules/tesseract.js-core', fileName),
    resolve(coreDestination, fileName),
  )),
  copyFile(
    resolve('node_modules/@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz'),
    resolve(languageDestination, 'chi_sim.traineddata.gz'),
  ),
]);
