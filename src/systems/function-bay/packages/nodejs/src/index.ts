import { Function, Runtime, tempDir } from '@function-bay/build';
import { v, ValidationTypeValue } from '@lowerdeck/validation';
import { $ as _$ } from 'bun';
import fs from 'fs/promises';
import path from 'path';
import { getMetorialLauncher } from './launcher';
import { cleanup } from './lib/cleanup';
import { fileExistsSync, readJsonFileOptional } from './lib/fs';

let $ = (...args: Parameters<typeof _$>) => {
  let commandString = '';
  let [templateStrings, ...values] = args;
  for (let i = 0; i < templateStrings.length; i++) {
    commandString += templateStrings[i];
    if (i < values.length) {
      commandString += values[i];
    }
  }

  let bashPrefix = 'bash -c "';
  if (commandString.startsWith(bashPrefix)) {
    commandString = commandString.slice(bashPrefix.length, -1);
  }

  console.log(`\n$ ${commandString}`);

  return _$(...args);
};

let spec = v.object({
  entrypoint: v.optional(v.string()),
  scripts: v.optional(
    v.object({
      build: v.optional(v.string())
    })
  ),
  nodeJsVersion: v.optional(v.string())
});

type Spec = ValidationTypeValue<typeof spec>;

let differentJsTypes = ['.ts', '.js', '.cjs', '.mjs'];
let tryExtensions = (base: string) => differentJsTypes.map(ext => base + ext);

let potentialDirs = ['', 'dist/', 'build/', 'output/', 'out/'];
let tryDirs = (filenames: string[]) =>
  filenames.flatMap(name => potentialDirs.map(dir => dir + name));

export let build = async (): Promise<void> => {
  console.log('Building Node.js function...');

  await $`bun i -g @vercel/ncc typescript @types/node`;
  await $`curl https://get.volta.sh | bash`;

  console.log('Setting up Node.js build environment...');

  let packageJson = await readJsonFileOptional<{
    main?: string;
    scripts?: { build?: string };
  }>('package.json');
  if (!packageJson) {
    console.log('No package.json found in the current directory. Exiting build.');
  }

  let functionBayFile =
    (await readJsonFileOptional<Spec>('function-bay.json')) ??
    (await readJsonFileOptional<Spec>('metorial.json'));

  let nodeJsVersionIdentifierRaw =
    functionBayFile?.nodeJsVersion ?? process.env.NODE_VERSION ?? '24.x';
  let nodeJsVersionIdentifier = nodeJsVersionIdentifierRaw.split('.')[0] + '.x';

  console.log(`Using Node.js version identifier: ${nodeJsVersionIdentifier}`);

  let env = { PATH: `${process.env.HOME}/.volta/bin:${process.env.PATH}` };

  await $`bash -c "volta install node@${nodeJsVersionIdentifier}"`.env(env);

  if (packageJson) {
    if (fileExistsSync('yarn.lock')) {
      console.log('Detected yarn.lock, installing dependencies with Yarn...');
      await $`bash -c "volta install yarn@1"`.env(env);
      await $`bash -c "yarn install"`.env(env);
      await $`bash -c "yarn add @vercel/ncc typescript @types/node"`.env(env).nothrow();
    } else if (fileExistsSync('pnpm-lock.yaml')) {
      console.log('Detected pnpm-lock.yaml, installing dependencies with pnpm...');
      await $`bash -c "volta install pnpm"`.env(env);
      await $`bash -c "pnpm install"`.env(env);
      await $`bash -c "pnpm add @vercel/ncc typescript @types/node"`.env(env).nothrow();
    } else if (fileExistsSync('bun.lock')) {
      console.log('Detected bun.lock, installing dependencies with Bun...');
      await $`bash -c "volta install bun"`.env(env);
      await $`bash -c "bun install"`.env(env);
      await $`bash -c "bun add @vercel/ncc typescript @types/node"`.env(env).nothrow();
    } else {
      console.log('Installing dependencies with npm...');
      await $`bash -c "npm install"`.env(env);
      await $`bash -c "npm install @vercel/ncc typescript @types/node"`.env(env).nothrow();
    }
  } else {
    console.log('No package.json found, skipping dependency installation.');
  }

  if (functionBayFile?.scripts?.build) {
    let buildScript = functionBayFile.scripts.build;
    console.log(`Detected build script: "${buildScript}"`);
    await $`bash -c ${buildScript}`.env(env);
  } else if (packageJson?.scripts?.build) {
    console.log(`Detected build script in package.json: "${packageJson.scripts.build}"`);
    await $`bash -c "npm run build"`.env(env);
  } else {
    console.log('No build script detected, skipping build step.');
  }

  let potentialEntrypoints = cleanup([
    functionBayFile?.entrypoint,
    packageJson?.main,

    ...tryDirs(tryExtensions('index')),
    ...tryDirs(tryExtensions('main')),
    ...tryDirs(tryExtensions('server')),
    ...tryDirs(tryExtensions('function'))
  ]).filter(fileExistsSync);

  if (potentialEntrypoints.length === 0) {
    throw new Error(
      'Could not find entrypoint for function. Please specify one in function-bay.json'
    );
  }

  let entrypoint = potentialEntrypoints[0];
  console.log(`Detected entrypoint: ${entrypoint}`);
  if (!functionBayFile?.entrypoint) {
    console.log(
      'You can specify this entrypoint in metorial.json to skip this detection step in the future.'
    );
  }

  console.log('Bundling function to Metorial Function Bay format...');

  let launcher = await getMetorialLauncher({
    bundledEntrypoint: entrypoint
  });
  for (let file of launcher.files) {
    await fs.writeFile(path.join(process.cwd(), file.filename), file.content, 'utf-8');
  }

  let outputTempDir = await tempDir();
  await $`ncc build ${launcher.entrypoint} -o ${outputTempDir} --minify --source-map --debug --target es2020`.env(
    env
  );

  console.log('\nCreating function package...');

  await Function.create({
    runtime: {
      identifier: '@function-bay/nodejs',
      layer: Runtime.layer,
      handler: 'index.handler',
      runtime: {
        identifier: 'nodejs',
        version: nodeJsVersionIdentifier as '24.x'
      }
    },
    directory: outputTempDir
  });

  console.log('Function package created successfully.');
};
