import { pathToFileURL } from 'node:url';
import { v } from '@lowerdeck/validation';
import { parseWith } from '../lib/validate';

let requestSchema = v.object({ raw: v.any(), now: v.string() });
let [file, exportName] = process.argv.slice(2);
if (!file || !exportName) throw new Error('A source file and parser export are required');
let { raw, now } = parseWith(requestSchema, await Bun.stdin.json(), 'pricing replay');
let source = await import(pathToFileURL(file).href);
let parse = source[exportName];
if (typeof parse !== 'function') throw new Error(`Repair removed ${exportName}`);
process.stdout.write(JSON.stringify(await parse(raw, now)));
