import { pathToFileURL } from 'node:url';
import { MARKER } from './marker';

let BRAND = Symbol.for('metorial.control.project');

let results: Record<string, { raw: unknown } | { error: string }> = {};

for (let path of process.argv.slice(2)) {
  try {
    let value = (await import(pathToFileURL(path).href)).default;

    if (typeof value !== 'object' || value === null || !(BRAND in value))
      throw new Error('control/index.ts must default-export project() or rootProject()');

    results[path] = { raw: (value as { raw: unknown }).raw };
  } catch (error) {
    results[path] = { error: error instanceof Error ? error.message : String(error) };
  }
}

process.stdout.write(MARKER + JSON.stringify(results));
