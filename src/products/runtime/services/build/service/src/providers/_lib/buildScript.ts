export let SYSTEM_OUTPUT_PREFIX = `X@%%MT0RL-)AL:: `;

export type SystemMarker =
  | { type: 'build.start' }
  | { type: 'build.end' }
  | { type: 'step.start'; stepId: string }
  | { type: 'step.end'; stepId: string }
  | { type: 'download-artifacts.start' }
  | { type: 'download-artifacts.end' }
  | { type: 'download-artifact.start'; artifactId: string }
  | { type: 'download-artifact.end'; artifactId: string }
  | { type: 'upload-artifact.register'; stepId: string };

export type BuildScriptArtifact = {
  id: string;
  oid: bigint;
  name: string;
  bucket: string;
  storageKey: string;
};

export type BuildScriptStep = {
  id: string;
  step: {
    type: string;
    initScript?: string[] | null;
    actionScript?: string[] | null;
    cleanupScript?: string[] | null;
    artifactToDownload?: BuildScriptArtifact | null;
    artifactToDownloadPath?: string | null;
    artifactToUploadName?: string | null;
    artifactToUploadPath?: string | null;
  } | null;
};

export type BuildScriptRun = {
  artifacts: BuildScriptArtifact[];
  setupStep: { id: string };
  teardownStep: { id: string };
  initSteps: BuildScriptStep[];
  actionSteps: BuildScriptStep[];
  cleanupSteps: BuildScriptStep[];
};

export type ArtifactTarget = { bucket: string; storageKey: string };

export type BuildScriptHooks = {
  runner: string;
  setupCommands: string[];
  logSystem: (marker: SystemMarker) => string;
  // `outputPath` is a shell-safe literal; the returned command writes the artifact there.
  downloadArtifact: (d: {
    artifact: BuildScriptArtifact;
    outputPath: string;
  }) => Promise<string> | string;
  uploadArtifact: (d: {
    stepId: string;
    path: string;
  }) => Promise<{ command: string; target: ArtifactTarget }>;
};

export let shellEscape = (str: string) => `'${str.replace(/'/g, `'\\''`)}'`;

export let echoSystemMarker = (marker: SystemMarker) =>
  `echo ${shellEscape(SYSTEM_OUTPUT_PREFIX + JSON.stringify(marker))}`;

export let parseSystemMarker = (line: string): SystemMarker | null => {
  let idx = line.indexOf(SYSTEM_OUTPUT_PREFIX);
  if (idx === -1) return null;

  try {
    return JSON.parse(line.slice(idx + SYSTEM_OUTPUT_PREFIX.length));
  } catch {
    return null;
  }
};

export let renderBuildCommands = async (run: BuildScriptRun, hooks: BuildScriptHooks) => {
  let log = hooks.logSystem;
  let artifactData: Record<string, ArtifactTarget> = {};

  let inputDownloads: string[] = [];
  for (let artifact of run.artifacts) {
    let outputPath = `/tmp/artifact_${artifact.oid}.zip`;

    inputDownloads.push(
      log({ type: 'download-artifact.start', artifactId: artifact.id }),
      await hooks.downloadArtifact({ artifact, outputPath }),
      `unzip -o ${outputPath} -d ./`,
      `rm ${outputPath}`,
      log({ type: 'download-artifact.end', artifactId: artifact.id })
    );
  }

  let actionCommands: string[] = [];
  for (let step of run.actionSteps) {
    let inner: string[] = [];

    if (step.step?.type == 'script') {
      inner = step.step.actionScript ?? ['echo "No action"'];
    } else if (step.step?.type == 'download_artifact') {
      let artifact = step.step.artifactToDownload;
      if (!artifact) throw new Error('Artifact to download not found');

      let outputPath = `/tmp/artifact_${artifact.oid}`;

      inner = [
        `echo "Downloading artifact ${artifact.name} ..."`,
        await hooks.downloadArtifact({ artifact, outputPath }),
        `mv ${outputPath} ${shellEscape(step.step.artifactToDownloadPath!)}`,
        'echo "Download complete."'
      ];
    } else if (step.step?.type == 'upload_artifact') {
      let upload = await hooks.uploadArtifact({
        stepId: step.id,
        path: step.step.artifactToUploadPath!
      });
      artifactData[step.id] = upload.target;

      inner = [
        `echo "Uploading artifact ${step.step.artifactToUploadName!} from ${step.step.artifactToUploadPath!} ..."`,
        upload.command,
        'echo "Upload complete."',
        log({ type: 'upload-artifact.register', stepId: step.id })
      ];
    }

    actionCommands.push(
      log({ type: 'step.start', stepId: step.id }),
      ...inner,
      log({ type: 'step.end', stepId: step.id })
    );
  }

  let commands = [
    log({ type: 'build.start' }),
    log({ type: 'step.start', stepId: run.setupStep.id }),
    `echo "Started build on Metorial Forge (runner: ${hooks.runner}) ..."`,
    'echo "Setting up build environment ..."',
    ...hooks.setupCommands,
    'mkdir -p ./forge',
    'cd ./forge',
    'mkdir -p ./output',
    log({ type: 'download-artifacts.start' }),
    'echo "Downloading initial files ..."',
    ...inputDownloads,
    log({ type: 'download-artifacts.end' }),
    'echo "Build environment setup complete."',
    log({ type: 'step.end', stepId: run.setupStep.id }),
    ...run.initSteps.flatMap(step => [
      log({ type: 'step.start', stepId: step.id }),
      ...(step.step?.initScript ?? ['echo "No action"']),
      log({ type: 'step.end', stepId: step.id })
    ]),
    ...actionCommands,
    ...run.cleanupSteps.flatMap(step => [
      log({ type: 'step.start', stepId: step.id }),
      ...(step.step?.cleanupScript ?? ['echo "No action"']),
      log({ type: 'step.end', stepId: step.id })
    ]),
    log({ type: 'step.start', stepId: run.teardownStep.id }),
    'echo "Tearing down build environment ..."',
    `echo "Build complete ... powered by Metorial Forge (${hooks.runner})."`,
    log({ type: 'step.end', stepId: run.teardownStep.id }),
    log({ type: 'build.end' })
  ];

  return { commands, artifactData };
};
