import { execFileSync } from 'child_process';
import { describe, expect, it } from 'vitest';
import {
  echoSystemMarker,
  parseSystemMarker,
  renderBuildCommands,
  shellEscape,
  SYSTEM_OUTPUT_PREFIX,
  type BuildScriptHooks,
  type BuildScriptRun
} from './buildScript';

let run: BuildScriptRun = {
  artifacts: [
    { id: 'fwoa_in', oid: 1n, name: 'input.zip', bucket: 'artifacts', storageKey: 'k/in' }
  ],
  setupStep: { id: 'fwos_setup' },
  teardownStep: { id: 'fwos_teardown' },
  initSteps: [],
  actionSteps: [
    {
      id: 'fwos_dl',
      step: {
        type: 'download_artifact',
        artifactToDownload: {
          id: 'fwoa_dl',
          oid: 2n,
          name: 'dl.tar',
          bucket: 'artifacts',
          storageKey: 'k/dl'
        },
        artifactToDownloadPath: './dl.tar'
      }
    },
    {
      id: 'fwos_up',
      step: {
        type: 'upload_artifact',
        artifactToUploadName: 'out.zip',
        artifactToUploadPath: './out.zip'
      }
    }
  ],
  cleanupSteps: []
};

let hooks = (overrides: Partial<BuildScriptHooks> = {}): BuildScriptHooks => ({
  runner: 'TEST/1',
  setupCommands: ['setup-command'],
  logSystem: marker => `marker ${marker.type}`,
  downloadArtifact: ({ artifact, outputPath }) => `fetch ${artifact.id} ${outputPath}`,
  uploadArtifact: async ({ stepId, path }) => ({
    command: `upload ${stepId} ${path}`,
    target: { bucket: 'artifacts', storageKey: `run/${stepId}` }
  }),
  ...overrides
});

describe('system markers', () => {
  it('round-trips a marker through the shell', () => {
    let marker = { type: 'step.start' as const, stepId: "fwos_'quoted' $HOME `x`" };

    let output = execFileSync('bash', ['-c', echoSystemMarker(marker)], { encoding: 'utf-8' });

    expect(parseSystemMarker(output.trim())).toEqual(marker);
  });

  it('finds a marker after a log prefix', () => {
    expect(
      parseSystemMarker(`2026-11-13T10:00:00Z ${SYSTEM_OUTPUT_PREFIX}{"type":"build.end"}`)
    ).toEqual({ type: 'build.end' });
  });

  it('ignores ordinary lines and broken markers', () => {
    expect(parseSystemMarker('npm install')).toBeNull();
    expect(parseSystemMarker(`${SYSTEM_OUTPUT_PREFIX}{"type":`)).toBeNull();
  });

  it('escapes single quotes for the shell', () => {
    expect(
      execFileSync('bash', ['-c', `printf %s ${shellEscape("it's $x")}`]).toString()
    ).toBe("it's $x");
  });
});

describe('renderBuildCommands', () => {
  it('uses the hooks for markers, downloads and uploads', async () => {
    let result = await renderBuildCommands(run, hooks());

    expect(result.commands).toEqual([
      'marker build.start',
      'marker step.start',
      'echo "Started build on Metorial Forge (runner: TEST/1) ..."',
      'echo "Setting up build environment ..."',
      'setup-command',
      'mkdir -p ./forge',
      'cd ./forge',
      'mkdir -p ./output',
      'marker download-artifacts.start',
      'echo "Downloading initial files ..."',
      'marker download-artifact.start',
      'fetch fwoa_in /tmp/artifact_1.zip',
      'unzip -o /tmp/artifact_1.zip -d ./',
      'rm /tmp/artifact_1.zip',
      'marker download-artifact.end',
      'marker download-artifacts.end',
      'echo "Build environment setup complete."',
      'marker step.end',
      'marker step.start',
      'echo "Downloading artifact dl.tar ..."',
      'fetch fwoa_dl /tmp/artifact_2',
      "mv /tmp/artifact_2 './dl.tar'",
      'echo "Download complete."',
      'marker step.end',
      'marker step.start',
      'echo "Uploading artifact out.zip from ./out.zip ..."',
      'upload fwos_up ./out.zip',
      'echo "Upload complete."',
      'marker upload-artifact.register',
      'marker step.end',
      'marker step.start',
      'echo "Tearing down build environment ..."',
      'echo "Build complete ... powered by Metorial Forge (TEST/1)."',
      'marker step.end',
      'marker build.end'
    ]);
    expect(result.artifactData).toEqual({
      fwos_up: { bucket: 'artifacts', storageKey: 'run/fwos_up' }
    });
  });

  it('emits marker payloads with step and artifact ids', async () => {
    let result = await renderBuildCommands(
      run,
      hooks({ logSystem: marker => `marker ${JSON.stringify(marker)}` })
    );

    let markers = result.commands
      .filter(command => command.startsWith('marker '))
      .map(command => JSON.parse(command.slice('marker '.length)));

    expect(markers).toEqual([
      { type: 'build.start' },
      { type: 'step.start', stepId: 'fwos_setup' },
      { type: 'download-artifacts.start' },
      { type: 'download-artifact.start', artifactId: 'fwoa_in' },
      { type: 'download-artifact.end', artifactId: 'fwoa_in' },
      { type: 'download-artifacts.end' },
      { type: 'step.end', stepId: 'fwos_setup' },
      { type: 'step.start', stepId: 'fwos_dl' },
      { type: 'step.end', stepId: 'fwos_dl' },
      { type: 'step.start', stepId: 'fwos_up' },
      { type: 'upload-artifact.register', stepId: 'fwos_up' },
      { type: 'step.end', stepId: 'fwos_up' },
      { type: 'step.start', stepId: 'fwos_teardown' },
      { type: 'step.end', stepId: 'fwos_teardown' },
      { type: 'build.end' }
    ]);
  });
});
