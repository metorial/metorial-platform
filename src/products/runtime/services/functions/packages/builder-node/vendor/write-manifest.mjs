import fs from 'node:fs';
import path from 'node:path';

let root = process.argv[2] ?? '.';
let modules = path.join(root, 'node_modules');
let packages = {};

let names = fs.readdirSync(modules).flatMap(entry => {
  if (entry.startsWith('.')) return [];
  if (!entry.startsWith('@')) return [entry];
  return fs.readdirSync(path.join(modules, entry)).map(name => `${entry}/${name}`);
});

for (let name of names.sort()) {
  let file = path.join(modules, name, 'package.json');
  if (!fs.existsSync(file)) continue;

  packages[name] = JSON.parse(fs.readFileSync(file, 'utf-8')).version;
}

fs.writeFileSync(
  path.join(root, 'manifest.json'),
  `${JSON.stringify({ packages }, null, 2)}\n`
);
