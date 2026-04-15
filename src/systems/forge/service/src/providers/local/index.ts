import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import JSZip from 'jszip';
import { createQueue } from '@lowerdeck/queue';
import { tmpdir } from 'os';
import { dirname, join, resolve, sep } from 'path';
import { env } from '../../env';
import { storage } from '../../storage';
import { ForgeBuildAdapter } from '../_lib/adapter';

let ensurePathWithin = (basePath: string, targetPath: string) => {
  let resolvedBasePath = resolve(basePath);
  let resolvedTargetPath = resolve(basePath, targetPath);

  if (
    resolvedTargetPath !== resolvedBasePath &&
    !resolvedTargetPath.startsWith(resolvedBasePath + sep)
  ) {
    throw new Error(`Path escapes local forge workspace: ${targetPath}`);
  }

  return resolvedTargetPath;
};

let extractZipToDirectory = async (data: Buffer, targetDirectory: string) => {
  let zip = await JSZip.loadAsync(data);

  for (let file of Object.values(zip.files)) {
    let outputPath = ensurePathWithin(targetDirectory, file.name);

    if (file.dir) {
      await fs.mkdir(outputPath, { recursive: true });
      continue;
    }

    await fs.mkdir(dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, await file.async('nodebuffer'));
  }
};

let runCommand = async (d: {
  command: string;
  cwd: string;
  envVars: Record<string, string>;
  onLine: (line: string) => Promise<void>;
}) => {
  return await new Promise<number>((resolvePromise, rejectPromise) => {
    let child = spawn('/bin/sh', ['-lc', d.command], {
      cwd: d.cwd,
      env: {
        ...process.env,
        ...d.envVars
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let writes = Promise.resolve();
    let scheduleWrite = (line: string) => {
      writes = writes.then(() => d.onLine(line));
    };

    let attachStream = (stream?: NodeJS.ReadableStream | null) => {
      if (!stream) return;

      let buffer = '';
      stream.setEncoding?.('utf-8');
      stream.on('data', (chunk: string) => {
        buffer += chunk;

        while (true) {
          let lineBreakIndex = buffer.search(/\r?\n/);
          if (lineBreakIndex === -1) break;

          let rawLine = buffer.slice(0, lineBreakIndex);
          let consumedLength = buffer[lineBreakIndex] === '\r' ? 2 : 1;
          buffer = buffer.slice(lineBreakIndex + consumedLength);

          scheduleWrite(rawLine);
        }
      });

      stream.on('end', () => {
        if (buffer.length) {
          scheduleWrite(buffer);
          buffer = '';
        }
      });
    };

    attachStream(child.stdout);
    attachStream(child.stderr);

    child.on('error', rejectPromise);
    child.on('close', code => {
      writes.then(() => resolvePromise(code ?? 0)).catch(rejectPromise);
    });
  });
};

let runCommands = async (d: {
  commands: string[];
  cwd: string;
  envVars: Record<string, string>;
  logger: { writeLine: (message: string, timestamp?: number) => Promise<void> };
}) => {
  for (let command of d.commands) {
    await d.logger.writeLine(`$ ${command}`);

    let exitCode = await runCommand({
      command,
      cwd: d.cwd,
      envVars: d.envVars,
      onLine: async line => {
        if (!line.trim()) return;
        await d.logger.writeLine(line);
      }
    });

    if (exitCode !== 0) {
      throw new Error(`Command failed with exit code ${exitCode}: ${command}`);
    }
  }
};

class LocalBuildAdapter extends ForgeBuildAdapter {
  readonly startBuildQueue = createQueue<{ runId: string }>({
    redisUrl: env.service.REDIS_URL,
    name: 'frg/local/bld/start',
    workerOpts: {
      concurrency: 1
    }
  });

  private readonly startBuildQueueProcessor = this.createStartBuildProcessor();

  readonly buildProviderProcessors = this.combineProcessors([this.startBuildQueueProcessor]);

  async startBuild(runId: string) {
    if (env.provider.DEFAULT_PROVIDER !== 'local') {
      throw new Error('Local forge provider is disabled');
    }

    let run = await this.resolveBuildRun(runId);
    let artifactData: Record<string, { bucket: string; storageKey: string }> = {};
    let tempDirectory = await fs.mkdtemp(join(tmpdir(), 'metorial-forge-local-'));
    let forgeDirectory = join(tempDirectory, 'forge');

    try {
      await fs.mkdir(join(forgeDirectory, 'output'), { recursive: true });

      await run.ctx.startRun({
        startedAt: new Date()
      });

      await this.withManagedStep(run.ctx, run.setupStep, async logger => {
        await logger.writeLine('Started build on Metorial Forge (runner: LOCAL/1) ...');
        await logger.writeLine('Setting up local build environment ...');
        await logger.writeLine('Downloading initial files ...');

        for (let artifact of run.artifacts) {
          await logger.writeLine(`Downloading artifact ${artifact.name} ...`);
          let artifactFile = await storage.getObject(artifact.bucket, artifact.storageKey);
          await extractZipToDirectory(artifactFile.data, forgeDirectory);
          await logger.writeLine(`Downloaded artifact ${artifact.name}.`);
        }

        await logger.writeLine('Build environment setup complete.');
      });

      for (let step of run.initSteps) {
        await this.withManagedStep(run.ctx, step, async logger => {
          await runCommands({
            commands: step.step?.initScript ?? ['echo "No action"'],
            cwd: forgeDirectory,
            envVars: run.runtimeEnv,
            logger
          });
        });
      }

      for (let step of run.actionSteps) {
        await this.withManagedStep(run.ctx, step, async logger => {
          if (step.step?.type === 'script') {
            await runCommands({
              commands: step.step.actionScript ?? ['echo "No action"'],
              cwd: forgeDirectory,
              envVars: run.runtimeEnv,
              logger
            });
            return;
          }

          if (step.step?.type === 'download_artifact') {
            let artifact = step.step.artifactToDownload;
            if (!artifact || !step.step.artifactToDownloadPath) {
              throw new Error('Artifact download step is missing configuration');
            }

            let destinationPath = ensurePathWithin(
              forgeDirectory,
              step.step.artifactToDownloadPath
            );

            await logger.writeLine(`Downloading artifact ${artifact.name} ...`);
            await fs.mkdir(dirname(destinationPath), { recursive: true });

            let downloadedArtifact = await storage.getObject(artifact.bucket, artifact.storageKey);
            await fs.writeFile(destinationPath, downloadedArtifact.data);
            await logger.writeLine('Download complete.');
            return;
          }

          if (step.step?.type === 'upload_artifact') {
            if (!step.step.artifactToUploadPath || !step.step.artifactToUploadName) {
              throw new Error('Artifact upload step is missing configuration');
            }

            let uploadPath = ensurePathWithin(forgeDirectory, step.step.artifactToUploadPath);
            let uploadInfo = await run.ctx.getArtifactUploadInfo();
            let fileContents = await fs.readFile(uploadPath);

            await logger.writeLine(
              `Uploading artifact ${step.step.artifactToUploadName} from ${step.step.artifactToUploadPath} ...`
            );

            await storage.putObject(uploadInfo.bucket, uploadInfo.storageKey, fileContents);

            let uploadedArtifactData = {
              bucket: uploadInfo.bucket,
              storageKey: uploadInfo.storageKey
            };
            artifactData[step.id] = uploadedArtifactData;

            await run.ctx.completeArtifactUpload({
              step,
              artifactData: uploadedArtifactData
            });

            await logger.writeLine('Upload complete.');
            return;
          }

          throw new Error(`Unsupported local forge step type: ${step.step?.type ?? 'unknown'}`);
        });
      }

      for (let step of run.cleanupSteps) {
        await this.withManagedStep(run.ctx, step, async logger => {
          await runCommands({
            commands: step.step?.cleanupScript ?? ['echo "No action"'],
            cwd: forgeDirectory,
            envVars: run.runtimeEnv,
            logger
          });
        });
      }

      await this.withManagedStep(run.ctx, run.teardownStep, async logger => {
        await logger.writeLine('Tearing down build environment ...');
        await logger.writeLine('Build complete ... powered by Metorial Forge (LOCAL/1).');
      });

      await run.ctx.completeBuild({
        status: 'succeeded',
        stepArtifacts: Object.entries(artifactData).map(([stepId, info]) => ({
          stepId,
          ...info
        }))
      });
    } catch (err) {
      await this.failBuild(run.ctx, err, 'Local forge build failed');
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }
}

export let localBuildAdapter = new LocalBuildAdapter();
export let startBuildQueue = localBuildAdapter.startBuildQueue;
export let buildProviderProcessors = localBuildAdapter.buildProviderProcessors;
