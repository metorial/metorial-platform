import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  captureDescriptor,
  descriptorInputs,
  gitInputs,
  materializeDescriptor,
  validateDescriptor,
  type InputDescriptor
} from './input-descriptor';

let [command, dockerfileArgument, destination, canonical = '', buildArguments = '{}'] =
  process.argv.slice(2);
let outputFile = process.env.GITHUB_OUTPUT;
let startedAt = Date.now();
let phaseStartedAt = startedAt;
let phaseTimings: { phase: string; seconds: string }[] = [];
let reportPhase = (phase: string) => {
  let seconds = ((Date.now() - phaseStartedAt) / 1000).toFixed(1);
  phaseTimings.push({ phase, seconds });
  console.log(`Image cache ${phase}: ${seconds}s`);
  phaseStartedAt = Date.now();
};
let run = (args: string[], env = process.env) => {
  let result = Bun.spawnSync(args, { env, stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode) throw new Error(`${args[0]} failed: ${result.stderr.toString()}`);
  return result.stdout.toString().trim();
};
let output = (name: string, value: string) => {
  console.log(`${name}=${value}`);
  if (outputFile) appendFileSync(outputFile, `${name}=${value}\n`);
};
let digest = async (reference: string, missingAllowed = false, initializeAllowed = false) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    let result = Bun.spawnSync(['regctl', 'image', 'digest', reference], {
      stdout: 'pipe',
      stderr: 'pipe'
    });
    if (!result.exitCode) return result.stdout.toString().trim();
    let error = result.stderr.toString();
    if (
      missingAllowed &&
      /manifest unknown|name unknown|not found|404/i.test(error) &&
      !/unauthorized|denied/i.test(error)
    )
      return null;
    if (
      missingAllowed &&
      process.env.IMAGE_CACHE_ANONYMOUS === 'true' &&
      /unauthorized|denied/i.test(error)
    ) {
      console.log(`Image cache ${reference} is not accessible anonymously`);
      return null;
    }
    if (initializeAllowed && attempt === 0 && /unauthorized|denied/i.test(error)) {
      let repository = reference.replace(/:[^/:]+$/, '');
      let initialize = Bun.spawnSync(
        [
          'regctl',
          'manifest',
          'put',
          `${repository}:cache-bootstrap-v1`,
          '--content-type',
          'application/vnd.oci.image.index.v1+json'
        ],
        {
          stdin: Buffer.from(
            JSON.stringify({
              schemaVersion: 2,
              mediaType: 'application/vnd.oci.image.index.v1+json',
              manifests: []
            })
          ),
          stdout: 'pipe',
          stderr: 'pipe'
        }
      );
      if (initialize.exitCode)
        throw new Error(
          `Cannot authenticate or initialize ${repository}: ${initialize.stderr.toString()}`
        );
      continue;
    }
    if (attempt === 2 || /unauthorized|denied/i.test(error))
      throw new Error(`Cannot resolve ${reference}: ${error}`);
    await Bun.sleep(1000 * (attempt + 1));
  }
  throw new Error('Registry lookup exhausted');
};

let registryCommand = async (args: string[], payload?: string) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    let result = Bun.spawnSync(['regctl', ...args], {
      stdin: payload === undefined ? undefined : Buffer.from(payload),
      stdout: 'pipe',
      stderr: 'pipe'
    });
    if (!result.exitCode) return result.stdout.toString();
    let error = result.stderr.toString();
    if (attempt === 2 || /unauthorized|denied/i.test(error))
      throw new Error(`Registry artifact operation failed: ${error}`);
    await Bun.sleep(1000 * (attempt + 1));
  }
  throw new Error('Registry artifact retries exhausted');
};

if (command === 'resolve') {
  let dockerfile = resolve(dockerfileArgument);
  let recipe = readFileSync(dockerfile, 'utf8');
  let argumentsMap = JSON.parse(buildArguments) as Record<string, string>;
  for (let match of recipe.matchAll(/^ARG (\w+)=(.+)$/gm)) argumentsMap[match[1]] ??= match[2];
  let tasksRecipe = recipe.replace(
    /\$\{(\w+)\}/g,
    (original, name) => argumentsMap[name] ?? original
  );
  let manifest = (await Bun.file(
    join(dirname(import.meta.path), 'services.json')
  ).json()) as Record<string, { dockerfile: string; image: string }>;
  if (!canonical)
    canonical =
      Object.values(manifest).find(entry => dockerfile.endsWith('/' + entry.dockerfile))
        ?.image ?? '';

  let stages = new Set(['scratch']);
  let bases = new Map<string, string>();

  for (let line of recipe.split('\n')) {
    let from = line.match(/^FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i);
    let copy = line.match(/^COPY\s+--from=(\S+)/i);
    let reference = from?.[1] ?? copy?.[1];
    if (reference && !stages.has(reference.toLowerCase()) && !/^\d+$/.test(reference)) {
      if (reference.includes('$'))
        throw new Error(`Dynamic external image requires explicit resolution: ${reference}`);
      if (!bases.has(reference))
        bases.set(reference, `${reference.split('@')[0]}@${await digest(reference)}`);
    }
    if (from?.[2]) stages.add(from[2].toLowerCase());
  }

  let syntax = recipe.match(/^# syntax=(\S+)/m)?.[1];
  if (syntax) bases.set(syntax, `${syntax.split('@')[0]}@${await digest(syntax)}`);

  reportPhase('base resolution');

  let pinned = recipe
    .replace(
      /^# syntax=(\S+)/m,
      (line, reference) => `# syntax=${bases.get(reference) ?? reference}`
    )
    .replace(
      /^(FROM\s+(?:--platform=\S+\s+)?)(\S+)/gim,
      (line, prefix, reference) => prefix + (bases.get(reference) ?? reference)
    )
    .replace(
      /^(COPY\s+--from=)(\S+)/gim,
      (line, prefix, reference) => prefix + (bases.get(reference) ?? reference)
    );
  let tasks = tasksRecipe.match(/^RUN bun \S*prune\.ts (.+)$/m)?.[1];
  let inputs = new Set<string>();
  let trackedInputs = gitInputs();
  reportPhase('Git inventory');
  let descriptorOrigin = 'not needed';
  let descriptor: InputDescriptor | undefined;
  let prepared = false;
  let cache =
    process.env.DOCKER_BUILD_CACHE_DIRECTORY ||
    join(process.env.RUNNER_TEMP ?? '/tmp', 'image-metadata');

  if (tasks) {
    let tooling = existsSync('oss/package.json')
      ? 'oss/src/tooling/docker-build'
      : 'src/tooling/docker-build';
    let keyOutput = run(
      [
        'bun',
        `${tooling}/dependency-cache.ts`,
        'fingerprint',
        dockerfile,
        ...tasks.trim().split(/\s+/)
      ],
      {
        ...process.env,
        DOCKER_BUILD_METADATA_ONLY: 'true',
        DOCKER_BUILD_CACHE_DIRECTORY: cache
      }
    );
    let key = keyOutput.match(/^key=(.+)$/m)?.[1];
    if (!key) throw new Error('Missing descriptor key');
    let descriptorFile = join(cache, 'descriptor.json');
    if (existsSync(descriptorFile)) {
      let stored = JSON.parse(readFileSync(descriptorFile, 'utf8'));
      if (stored.key === key) {
        descriptor = validateDescriptor(stored, key);
        descriptorOrigin = 'local metadata cache';
      }
    }
    let repositories = [...new Set([destination, canonical].filter(Boolean))];
    if (!descriptor && process.env.IMAGE_DESCRIPTOR_REGISTRY !== 'false') {
      for (let repository of repositories) {
        let reference = `${repository}:descriptor-${key}`;
        let found = await digest(
          reference,
          true,
          repository === destination && process.env.IMAGE_CACHE_PUBLISH === 'true'
        );
        if (!found) continue;
        let payload = await registryCommand(['artifact', 'get', `${repository}@${found}`]);
        if (Buffer.byteLength(payload) > 50 * 1024 * 1024)
          throw new Error('Input descriptor exceeds size limit');
        descriptor = validateDescriptor(JSON.parse(payload), key);
        mkdirSync(cache, { recursive: true });
        await Bun.write(descriptorFile, JSON.stringify(descriptor));
        descriptorOrigin = `${repository}@${found}`;
        console.log(`Input descriptor source: ${descriptorOrigin}`);
        break;
      }
    }
    reportPhase('descriptor lookup');
    if (!descriptor) {
      console.log(run(['bun', `${tooling}/prune.ts`, ...tasks.trim().split(/\s+/)]));
      console.log(
        run(['bun', `${tooling}/dependency-cache.ts`, 'capture'], {
          ...process.env,
          DOCKER_BUILD_CACHE_DIRECTORY: cache
        })
      );
      descriptor = captureDescriptor(cache, key);
      await Bun.write(descriptorFile, JSON.stringify(descriptor));
      prepared = true;
      descriptorOrigin = 'cold discovery';
      console.log('Input descriptor: discovered');
    } else console.log('Input descriptor: reused; no Turbo or source copying');
    reportPhase('descriptor discovery');
    if (
      process.env.IMAGE_CACHE_PUBLISH === 'true' &&
      process.env.IMAGE_DESCRIPTOR_REGISTRY !== 'false'
    ) {
      let reference = `${destination}:descriptor-${key}`;
      let existing = await digest(reference, true, true);
      if (!existing) {
        await registryCommand(
          [
            'artifact',
            'put',
            reference,
            '--artifact-type',
            'application/vnd.metorial.image-inputs.v1+json'
          ],
          JSON.stringify(descriptor)
        );
        let published = await digest(reference);
        let verified = validateDescriptor(
          JSON.parse(
            await registryCommand(['artifact', 'get', `${destination}@${published}`])
          ),
          key
        );
        if (JSON.stringify(verified) !== JSON.stringify(descriptor))
          throw new Error('Descriptor publication verification failed');
      }
    }
    inputs.add(`${tooling}/prune.ts`);
  }

  reportPhase('descriptor publication');
  let tracked = [...trackedInputs.keys()];
  for (let line of recipe.split('\n')) {
    if (!/^COPY\s/i.test(line) || /--from=/.test(line)) continue;
    let tokens = (line.replace(/^COPY\s+/i, '').match(/"[^"]*"|'[^']*'|\S+/g) ?? [])
      .filter(token => !token.startsWith('--'))
      .map(token => token.replace(/^["']|["']$/g, ''));
    for (let source of tokens.slice(0, -1)) {
      source = source.replace(/^\//, '').replace(/\/$/, '');
      if (source === '.' && tasks) continue;
      if (source.includes('$') || source.startsWith('['))
        throw new Error(`Unsupported COPY source: ${source}`);
      let glob = new Bun.Glob(source);
      for (let file of tracked) {
        if (
          source === '.' ||
          file === source ||
          file.startsWith(source + '/') ||
          glob.match(file)
        )
          inputs.add(file);
      }
    }
  }

  for (let file of ['.dockerignore', '.gitignore']) if (existsSync(file)) inputs.add(file);
  let hash = createHash('sha256');
  hash.update(
    JSON.stringify({
      version: 2,
      platform: 'linux/amd64',
      recipe: pinned,
      args: JSON.parse(buildArguments)
    })
  );
  hash.update(readFileSync(import.meta.path));
  hash.update(readFileSync(join(dirname(import.meta.path), 'input-descriptor.ts')));
  let records = descriptor
    ? descriptorInputs(descriptor, trackedInputs)
    : new Map<string, { mode: string; oid: string }>();
  for (let file of inputs) {
    let input = trackedInputs.get(file);
    if (!input) throw new Error(`Build input is not tracked: ${file}`);
    records.set(`direct/${file}`, input);
  }
  for (let [path, input] of [...records].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0
  ))
    hash.update(JSON.stringify([path, input.mode, input.oid]));

  reportPhase('input hashing');

  let tag = `build-v2-${hash.digest('hex')}`;
  let pinnedDirectory = join(process.env.RUNNER_TEMP ?? '/tmp', `image-${tag}`);
  mkdirSync(pinnedDirectory, { recursive: true });
  let pinnedFile = join(pinnedDirectory, 'Dockerfile');
  await Bun.write(pinnedFile, pinned);
  let source = '';
  for (let repository of process.env.IMAGE_CACHE_LOOKUP === 'false'
    ? []
    : [...new Set([destination, canonical].filter(Boolean))]) {
    let found = await digest(
      `${repository}:${tag}`,
      true,
      repository === destination && process.env.IMAGE_CACHE_PUBLISH === 'true'
    );
    if (found) {
      source = `${repository}@${found}`;
      break;
    }
  }

  reportPhase('registry lookup');

  if (!source && descriptor && !prepared) {
    materializeDescriptor(descriptor, trackedInputs);
    prepared = true;
  }
  reportPhase('materialization');
  output('prepared', String(prepared));
  output('context', resolve('out'));
  output('tag', tag);
  output('dockerfile', pinnedFile);
  output('source', source);
  output('hit', String(Boolean(source)));
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Image cache\n- Image: ${destination}\n- Fingerprint: ${tag}\n- Descriptor: ${descriptorOrigin}\n- Result: ${source || 'miss; build required'}\n- Resolve time: ${((Date.now() - startedAt) / 1000).toFixed(1)}s\n${phaseTimings.map(timing => `- ${timing.phase}: ${timing.seconds}s`).join('\n')}\n`
    );
} else if (command === 'copy') {
  let sourceDigest = dockerfileArgument.split('@')[1] ?? (await digest(dockerfileArgument));
  let source = `${dockerfileArgument.split('@')[0].replace(/:[^/:]+$/, '')}@${sourceDigest}`;
  for (let target of destination.split(/\s+/).filter(Boolean)) {
    for (let attempt = 0; ; attempt++) {
      try {
        run(['regctl', 'image', 'copy', source, target]);
        break;
      } catch (error) {
        if (attempt === 2 || /unauthorized|denied/i.test(String(error))) throw error;
        await Bun.sleep(1000 * (attempt + 1));
      }
    }
    let expected = sourceDigest;
    if ((await digest(target)) !== expected)
      throw new Error(`Digest mismatch after copying ${target}`);
    console.log(`Verified ${target}`);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `- Verified publication: ${target} @ ${expected}\n`
      );
  }
} else {
  throw new Error(`Unknown command: ${command}`);
}
