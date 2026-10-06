import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

let [dockerfile, argumentsJson = '{}'] = process.argv.slice(2);
let recipe = readFileSync(dockerfile, 'utf8');
let buildArguments = JSON.parse(argumentsJson) as Record<string, string>;
let output = (name: string, value: string) => {
  console.log(`${name}=${value}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
};

for (let match of recipe.matchAll(/^ARG (\w+)=(.+)$/gm)) buildArguments[match[1]] ??= match[2];
let expanded = recipe.replace(/\$\{(\w+)\}/g, (original, name) => buildArguments[name] ?? original);
let tasks = expanded.match(/^RUN bun \S*prune\.ts (.+)$/m)?.[1];
output('pruned', String(Boolean(tasks)));

if (tasks) {
  let cache = resolve(process.env.RUNNER_TEMP ?? '/tmp', 'image-metadata');
  let result = Bun.spawnSync(['bun', join(dirname(import.meta.path), 'dependency-cache.ts'), 'fingerprint', resolve(dockerfile), ...tasks.trim().split(/\s+/)], {
    env: { ...process.env, DOCKER_BUILD_METADATA_ONLY: 'true', DOCKER_BUILD_CACHE_DIRECTORY: cache },
    stdout: 'pipe', stderr: 'pipe'
  });
  if (result.exitCode) throw new Error(result.stderr.toString());
  for (let line of result.stdout.toString().trim().split('\n')) {
    let separator = line.indexOf('=');
    output(line.slice(0, separator), line.slice(separator + 1));
  }
}
