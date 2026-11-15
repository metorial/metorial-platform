// Extracts the Lambda proxy wrapper that each listed commit's function-bay deploy.ts would
// upload, by evaluating its two template literals the same way buildNodeProxyWrapper does.
// The bootstrap is embedded unbundled: production bundles it with Bun.build, which only
// inlines the same packages that the harness installs into node_modules.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

let [ossRoot, outDir, ...commits] = process.argv.slice(2);
if (!ossRoot || !outDir || commits.length === 0) {
  console.error('usage: extract-wrappers.mjs <oss-root> <out-dir> <commit>...');
  process.exit(2);
}

let deployPaths = [
  'src/systems/function-bay/service/src/providers/aws-lambda/deploy.ts',
  'src/function-bay/service/src/providers/aws-lambda/deploy.ts',
  'src/products/runtime/services/functions/service/src/providers/aws-lambda/deploy.ts'
];

let git = (...args) =>
  execFileSync('git', ['-C', ossRoot, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'ignore']
  });

let readDeploy = commit => {
  for (let path of deployPaths) {
    try {
      return { path, source: git('show', `${commit}:${path}`) };
    } catch {}
  }
  throw new Error(`no aws-lambda deploy.ts at ${commit}`);
};

let templateLiteral = (source, pattern, name) => {
  let match = source.match(pattern);
  if (!match) throw new Error(`could not find ${name}`);
  return match[1];
};

let manifest = [];
for (let commit of commits) {
  let { path, source } = readDeploy(commit);
  let bootstrapRaw = templateLiteral(
    source,
    /let nodeProxyWrapperBootstrap = `([\s\S]*?)`;\n/,
    'nodeProxyWrapperBootstrap'
  );
  let wrapperRaw = templateLiteral(
    source,
    /let nodeProxyWrapper = \(originalHandler: string, bootstrapCode: string\) => `([\s\S]*?)`;\n/,
    'nodeProxyWrapper'
  );
  let fileName = templateLiteral(
    source,
    /zip\.file\('([^']+)', await buildNodeProxyWrapper/,
    'wrapper file name'
  );

  let bootstrap = new Function(`return \`${bootstrapRaw}\`;`)();
  let wrapper = new Function('originalHandler', 'bootstrapCode', `return \`${wrapperRaw}\`;`)(
    'index.handler',
    bootstrap
  );

  let resolved = git('rev-parse', '--short=10', commit).trim();
  let dir = join(outDir, resolved);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, fileName), wrapper);

  let date = git('log', '-1', '--format=%cs', commit).trim();
  manifest.push({
    commit: resolved,
    requested: commit,
    date,
    deployPath: path,
    wrapper: fileName
  });
  console.error(`extracted ${resolved} (${date}) from ${path} -> ${fileName}`);
}

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
