import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { env } from '../src/env';
import { storage } from '../src/storage';
import { forge } from './client';
import { createTenant, createWorkflow } from './fixtures';

let BUILD_TIMEOUT_MS = 10 * 60 * 1000;

// Builds need a real runner: Docker for `local`, a cluster for `kubernetes`, AWS for CodeBuild.
let runsBuilds =
  env.provider.DEFAULT_PROVIDER === 'kubernetes' ||
  process.env.FORGE_E2E_RUN_BUILDS === 'true';

type Step = Parameters<typeof forge.workflowVersion.create>[0]['steps'][number];

let runWorkflow = async (steps: Step[]) => {
  let tenant = await createTenant();
  let workflow = await createWorkflow(tenant.id);
  await forge.workflowVersion.create({
    tenantId: tenant.id,
    workflowId: workflow.id,
    name: uniqueId('version'),
    steps
  });

  let created = await forge.workflowRun.create({
    tenantId: tenant.id,
    workflowId: workflow.id,
    env: { GREETING: "hello from forge's e2e" },
    files: [{ filename: 'index.js', content: 'console.log("forge input file")' }]
  });

  let ids = { tenantId: tenant.id, workflowId: workflow.id, workflowRunId: created.id };
  let run = await eventually(
    async () => {
      let current = await forge.workflowRun.get(ids);
      if (current.status !== 'succeeded' && current.status !== 'failed') {
        throw new Error(`Run ${created.id} is still ${current.status}`);
      }
      return current;
    },
    { timeoutMs: BUILD_TIMEOUT_MS, intervalMs: 2000 }
  );

  let output = await eventually(async () => {
    let result = await forge.workflowRun.getOutput(ids);
    if (result.some(o => o.source === 'temp')) throw new Error('Output is not stored yet');
    return result;
  });

  let logsOf = (name: string) =>
    output
      .find(o => o.step.name === name)
      ?.logs.map(l => l.message)
      .join('\n') ?? '';

  return { run, logsOf };
};

describe.runIf(runsBuilds)(`forge builds on ${env.provider.DEFAULT_PROVIDER}`, () => {
  it(
    'runs a workflow end to end and stores its output and artifact',
    async () => {
      let { run, logsOf } = await runWorkflow([
        {
          name: 'Build',
          type: 'script',
          actionScript: [
            'cat index.js',
            'echo "$GREETING"',
            'mkdir -p output && echo built > output/result.txt',
            'zip -j output/result.zip output/result.txt'
          ]
        },
        {
          name: 'Upload',
          type: 'upload_artifact',
          artifactSourcePath: './output/result.zip',
          artifactName: 'result.zip'
        }
      ]);

      expect(run.status, logsOf('Build')).toBe('succeeded');
      expect(run.steps.every(step => step.status === 'succeeded')).toBe(true);
      expect(logsOf('Build')).toContain('console.log("forge input file")');
      expect(logsOf('Build')).toContain("hello from forge's e2e");

      let artifacts = await db.workflowArtifact.findMany({
        where: { run: { id: run.id }, type: 'output' }
      });
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]).toMatchObject({ name: 'result.zip' });

      let object = await storage.getObject(artifacts[0]!.bucket, artifacts[0]!.storageKey);
      let zip = await JSZip.loadAsync(object.data);
      expect(await zip.file('result.txt')!.async('string')).toBe('built\n');
    },
    BUILD_TIMEOUT_MS + 60_000
  );

  it(
    'fails the run at the failing step and cancels the rest',
    async () => {
      let { run, logsOf } = await runWorkflow([
        { name: 'Fail', type: 'script', actionScript: ['echo before failing', 'exit 3'] },
        { name: 'Never', type: 'script', actionScript: ['echo never runs'] }
      ]);

      expect(run.status).toBe('failed');
      expect(run.steps.find(step => step.name === 'Fail')?.status).toBe('failed');
      expect(run.steps.find(step => step.name === 'Never')?.status).toBe('canceled');
      expect(logsOf('Fail')).toContain('before failing');
      expect(logsOf('Never')).not.toContain('never runs');
    },
    BUILD_TIMEOUT_MS + 60_000
  );
});
