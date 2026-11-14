import { spawnSync } from 'child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseSystemMarker, type BuildScriptRun } from '../_lib/buildScript';
import { renderKubernetesBuild } from './script';

let uniqueOidBase = BigInt(Date.now()) * 10n;

let createRun = (
  actionScript: string[] = ['echo building'],
  oidBase = uniqueOidBase
): BuildScriptRun => {
  let artifact = (n: number, name: string) => ({
    id: `fwoa_${n}`,
    oid: oidBase + BigInt(n),
    name,
    bucket: 'artifacts',
    storageKey: `fwor_1/${name}`
  });

  return {
    artifacts: [artifact(1, 'input.zip')],
    setupStep: { id: 'fwos_setup' },
    teardownStep: { id: 'fwos_teardown' },
    initSteps: [{ id: 'fwos_init', step: { type: 'script', initScript: ['echo init'] } }],
    actionSteps: [
      { id: 'fwos_build', step: { type: 'script', actionScript } },
      {
        id: 'fwos_dl',
        step: {
          type: 'download_artifact',
          artifactToDownload: artifact(2, 'bundle.tar'),
          artifactToDownloadPath: "./it's bundle.tar"
        }
      },
      {
        id: 'fwos_dl_again',
        step: {
          type: 'download_artifact',
          artifactToDownload: artifact(2, 'bundle.tar'),
          artifactToDownloadPath: './copy.tar'
        }
      },
      {
        id: 'fwos_up',
        step: {
          type: 'upload_artifact',
          artifactToUploadName: 'output.zip',
          artifactToUploadPath: './output/out file.zip'
        }
      }
    ],
    cleanupSteps: [{ id: 'fwos_cleanup', step: { type: 'script', cleanupScript: null } }]
  };
};

let render = (run: BuildScriptRun) =>
  renderKubernetesBuild({
    run,
    allocateUpload: async stepId => ({ bucket: 'artifacts', storageKey: `fwor_1/${stepId}` })
  });

let sandbox = mkdtempSync(join(tmpdir(), 'forge-k8s-script-'));
let bin = join(sandbox, 'bin');

let fake = (name: string, body: string) => {
  writeFileSync(join(bin, name), `#!/bin/bash\n${body}\n`);
  chmodSync(join(bin, name), 0o755);
};

spawnSync('mkdir', ['-p', bin]);
fake(
  'curl',
  `echo "curl $*" >> "$FAKE_LOG"
out=""
upload=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift ;;
    --upload-file) upload="$2"; shift ;;
  esac
  shift
done
if [ -n "$upload" ] && [ ! -f "$upload" ]; then exit 26; fi
if [ -n "$out" ]; then echo artifact > "$out"; fi`
);
fake(
  'cat',
  `if [ "$1" = /var/run/metorial/identity/token ]; then printf 'pod-token'; else exec /bin/cat "$@"; fi`
);
fake(
  'unzip',
  `echo "unzip $*" >> "$FAKE_LOG"; mkdir -p output; echo zipped > "output/out file.zip"`
);

let runScript = (script: string) => {
  let dir = mkdtempSync(join(sandbox, 'run-'));
  let log = join(dir, 'calls.log');
  writeFileSync(join(dir, 'script.sh'), script);
  writeFileSync(log, '');

  let result = spawnSync('bash', [join(dir, 'script.sh')], {
    cwd: dir,
    encoding: 'utf-8',
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      CLUSTER_MANAGER_POD_ADDR: 'https://10.43.0.10:52241/',
      FAKE_LOG: log
    }
  });

  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    markers: result.stdout
      .split('\n')
      .map(line => parseSystemMarker(line))
      .filter(Boolean),
    calls: readFileSync(log, 'utf-8').trim().split('\n')
  };
};

afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

describe('kubernetes build script', () => {
  it('renders the script and the artifact spec', async () => {
    let rendered = await render(createRun(undefined, 0n));

    await expect(rendered.script).toMatchFileSnapshot('__snapshots__/full.script.sh');
    expect(rendered.downloads).toEqual([
      { artifactId: 'fwoa_1', bucket: 'artifacts', key: 'fwor_1/input.zip' },
      { artifactId: 'fwoa_2', bucket: 'artifacts', key: 'fwor_1/bundle.tar' }
    ]);
    expect(rendered.uploads).toEqual([
      { stepId: 'fwos_up', bucket: 'artifacts', key: 'fwor_1/fwos_up' }
    ]);
    expect(rendered.artifactData).toEqual({
      fwos_up: { bucket: 'artifacts', storageKey: 'fwor_1/fwos_up' }
    });
    expect(spawnSync('bash', ['-n', '-c', rendered.script]).status).toBe(0);
  });

  it('fetches and uploads artifacts through the cluster-manager with the pod token', async () => {
    let { script } = await render(createRun());

    let result = runScript(script);

    expect(result.status, result.output).toBe(0);
    expect(result.markers.at(0)).toEqual({ type: 'build.start' });
    expect(result.markers.at(-1)).toEqual({ type: 'build.end' });
    expect(result.markers).toContainEqual({
      type: 'upload-artifact.register',
      stepId: 'fwos_up'
    });

    let curlCalls = result.calls.filter(call => call.startsWith('curl '));
    expect(curlCalls).toHaveLength(4);
    for (let call of curlCalls) {
      expect(call).toContain(
        '-fsS --retry 5 --retry-connrefused --noproxy * -H Authorization: Bearer pod-token'
      );
    }
    expect(curlCalls[0]).toMatch(
      /-o \/tmp\/artifact_\d+\.zip https:\/\/10\.43\.0\.10:52241\/v1\/builds\/self\/artifacts\/fwoa_1$/
    );
    expect(curlCalls[1]).toMatch(/v1\/builds\/self\/artifacts\/fwoa_2$/);
    expect(curlCalls[3]).toContain(
      '-X PUT -H Content-Type: application/octet-stream --upload-file ./output/out file.zip https://10.43.0.10:52241/v1/builds/self/uploads/fwos_up'
    );
  });

  it('stops at the first failing command, including inside && lists', async () => {
    let { script } = await render(
      createRun(['echo before', 'false && echo never', 'echo after'])
    );

    let result = runScript(script);

    expect(result.status).toBe(1);
    expect(result.output).toContain('before');
    expect(result.output).toContain('Command failed with exit code 1');
    expect(result.output).not.toContain('never');
    expect(result.output).not.toContain('after');
    expect(result.markers.at(-1)).toEqual({ type: 'step.start', stepId: 'fwos_build' });
    expect(result.markers).not.toContainEqual({ type: 'build.end' });
  });

  it('fails the build when an upload source is missing', async () => {
    let run = createRun();
    (run.actionSteps[3]!.step as any).artifactToUploadPath = './missing.zip';

    let result = runScript((await render(run)).script);

    expect(result.status).toBe(26);
    expect(result.markers).not.toContainEqual({
      type: 'upload-artifact.register',
      stepId: 'fwos_up'
    });
  });
});
