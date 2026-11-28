import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { getDetectionCatalog } from './detection';

let defaultOut = path.join(import.meta.dirname, '..', 'detection.json');

let { values } = parseArgs({
  options: { out: { type: 'string', default: defaultOut } }
});

let catalog = getDetectionCatalog();
let outFile = path.resolve(values.out!);

await writeFile(outFile, `${JSON.stringify(catalog, null, 2)}\n`);

console.log(`${catalog.tools.length} tools, version ${catalog.version}, wrote ${outFile}`);
