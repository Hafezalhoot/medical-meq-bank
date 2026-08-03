#!/usr/bin/env node

/**
 * One-time migration for the two lectures originally embedded in src/app.js.
 *
 * The data prefix is evaluated inside an isolated VM context, the final lecture
 * objects are serialized as readable JSON, and the runtime keeps only the
 * subject registry plus an initially empty lecture array.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const APP_PATH = path.join(ROOT, 'src', 'app.js');
const LECTURE_DIR = path.join(ROOT, 'lectures');
const DATA_DIR = path.join(LECTURE_DIR, 'data');
const CATALOG_PATH = path.join(LECTURE_DIR, 'catalog.json');
const RUNTIME_MARKER = 'const $=id=>document.getElementById(id);';

const source = fs.readFileSync(APP_PATH, 'utf8');
const markerIndex = source.indexOf(RUNTIME_MARKER);
if (markerIndex < 0) {
  throw new Error(`Could not find runtime marker: ${RUNTIME_MARKER}`);
}

const dataPrefix = source.slice(0, markerIndex);
if (!dataPrefix.includes('const congenitalCases = [')) {
  throw new Error('Congenital lecture data was not found in the application prefix');
}
if (!dataPrefix.includes('const bphCases = [')) {
  throw new Error('BPH lecture data was not found in the application prefix');
}

const context = Object.create(null);
vm.createContext(context);
vm.runInContext(
  `${dataPrefix}\nglobalThis.__lectures = lectures; globalThis.__subjects = subjects;`,
  context,
  {timeout: 10_000, filename: 'embedded-lecture-data.js'}
);

const extracted = JSON.parse(JSON.stringify(context.__lectures));
const subjects = JSON.parse(JSON.stringify(context.__subjects));
if (!Array.isArray(extracted) || extracted.length !== 2) {
  throw new Error(`Expected two embedded lectures; found ${extracted?.length}`);
}
if (!Array.isArray(subjects) || subjects.length < 1) {
  throw new Error('Subject registry was not extracted');
}

const expectedIds = new Set([
  'urology-congenital-anomalies',
  'urology-bph-prostate-carcinoma'
]);
for (const lecture of extracted) {
  if (!expectedIds.delete(lecture.id)) {
    throw new Error(`Unexpected or duplicate embedded lecture: ${lecture.id}`);
  }
}
if (expectedIds.size) {
  throw new Error(`Missing embedded lectures: ${[...expectedIds].join(', ')}`);
}

fs.mkdirSync(DATA_DIR, {recursive: true});
for (const lecture of extracted) {
  const outputPath = path.join(DATA_DIR, `${lecture.id}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(lecture, null, 2)}\n`, 'utf8');
  console.log(`Extracted ${lecture.id} -> ${path.relative(ROOT, outputPath)}`);
}

const existingCatalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const existingLectures = [];
for (const entry of existingCatalog.lectures || []) {
  const sourcePath = path.join(LECTURE_DIR, entry.file);
  const lecture = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  existingLectures.push(lecture);
}

const allLectures = [...extracted, ...existingLectures];
const ids = new Set();
for (const lecture of allLectures) {
  if (ids.has(lecture.id)) throw new Error(`Duplicate lecture id: ${lecture.id}`);
  ids.add(lecture.id);
}
allLectures.sort((a, b) =>
  a.subjectKey.localeCompare(b.subjectKey) || a.order - b.order || a.id.localeCompare(b.id)
);

const countKeys = ['cases', 'coreShorts', 'imageQuestions', 'detailedShorts', 'rapid'];
const catalog = {
  $schema: './catalog.schema.json',
  version: 1,
  lectures: allLectures.map(lecture => ({
    id: lecture.id,
    title: lecture.title,
    subjectKey: lecture.subjectKey,
    order: lecture.order,
    file: `data/${lecture.id}.json`,
    expectedCounts: Object.fromEntries(
      countKeys.map(key => [key, lecture[key].length])
    )
  }))
};
fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

const minimalPrefix = [
  `const subjects = ${JSON.stringify(subjects, null, 2)};`,
  'const lectures = [];',
  '',
].join('\n');
const migratedSource = minimalPrefix + source.slice(markerIndex);
if (migratedSource.includes('const congenitalCases = [')) {
  throw new Error('Congenital data remains embedded after migration');
}
if (migratedSource.includes('const bphCases = [')) {
  throw new Error('BPH data remains embedded after migration');
}
fs.writeFileSync(APP_PATH, migratedSource, 'utf8');

console.log(`Updated ${path.relative(ROOT, APP_PATH)} from ${source.length} to ${migratedSource.length} characters`);
console.log(`Catalog now contains ${catalog.lectures.length} lectures`);
