import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Workflow, WorkflowRun } from '../../prisma/generated/client';
import { db } from '../db';
import { encryption } from '../encryption';
import { ID, snowflake } from '../id';
import { createZipFromFiles } from '../lib/zip';
import { startAwsCodeBuildQueue } from '../providers/aws-codebuild';
import { storage } from '../storage';
import { providerService } from './provider';
import { workflowArtifactService } from './workflowArtifact';

let include = {
  workflow: true,
  version: true,
  steps: { include: { step: { include: { artifactToDownload: true } } } },
  artifacts: true
};

class workflowRunServiceImpl {
  async createWorkflowRun(d: {
    workflow: Workflow;
    input: {
      env: Record<string, string>;
      files: {
        filename: string;
        content: string;
        encoding?: 'utf-8' | 'base64';
      }[];
    };
  }) {
    if (!d.workflow.currentVersionOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot create workflow run for workflow without a version'
        })
      );
    }

    let zip = await createZipFromFiles(d.input.files);

    let currentVersion = await db.workflowVersion.findUniqueOrThrow({
      where: { oid: d.workflow.currentVersionOid },
      include: { steps: true }
    });

    let id = await ID.generateId('workflowRun');

    let index = 0;

    let run = await db.workflowRun.create({
      data: {
        oid: snowflake.nextId(),
        id,

        status: 'pending',

        workflowOid: d.workflow.oid,
        versionOid: currentVersion.oid,
        providerOid: (await providerService.getDefaultProvider()).oid,

        encryptedEnvironmentVariables: await encryption.encrypt({
          secret: JSON.stringify(d.input.env),
          entityId: id
        }),

        steps: {
          create: [
            {
              oid: snowflake.nextId(),
              id: ID.generateIdSync('workflowRunStep'),
              name: 'Setup Build Environment',
              type: 'setup',
              status: 'pending',
              index: index++
            },

            ...currentVersion.steps
              .filter(s => s.type == 'script' && s.initScript.length)
              .map(s => ({
                oid: snowflake.nextId(),
                id: ID.generateIdSync('workflowRunStep'),
                name: `Step: ${s.name} (setup)`,
                type: 'init' as const,
                status: 'pending' as const,
                index: index++,
                stepOid: s.oid
              })),

            ...currentVersion.steps.map(s => ({
              oid: snowflake.nextId(),
              id: ID.generateIdSync('workflowRunStep'),
              name: `Step: ${s.name}`,
              type: 'action' as const,
              status: 'pending' as const,
              index: index++,
              stepOid: s.oid
            })),

            ...currentVersion.steps
              .filter(s => s.type == 'script' && s.cleanupScript.length)
              .map(s => ({
                oid: snowflake.nextId(),
                id: ID.generateIdSync('workflowRunStep'),
                name: `Step: ${s.name} (cleanup)`,
                type: 'cleanup' as const,
                status: 'pending' as const,
                index: index++,
                stepOid: s.oid
              })),

            {
              oid: snowflake.nextId(),
              id: ID.generateIdSync('workflowRunStep'),
              name: 'Teardown Build Environment',
              type: 'teardown',
              status: 'pending',
              index: index++
            }
          ]
        }
      },
      include
    });

    let input = await workflowArtifactService.putArtifact({
      run,
      content: zip,
      type: 'input',
      name: 'input.zip'
    });
    run.artifacts.push(input);

    await startAwsCodeBuildQueue.add({
      runId: run.id
    });

    return run;
  }

  async getWorkflowRunById(d: { id: string; workflow: Workflow }) {
    let workflowRun = await db.workflowRun.findFirst({
      where: {
        id: d.id,
        workflowOid: d.workflow.oid
      },
      include
    });
    if (!workflowRun) throw new ServiceError(notFoundError('workflow.run'));
    return workflowRun;
  }

  async listWorkflowRuns(d: { workflow: Workflow }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.workflowRun.findMany({
            ...opts,
            where: {
              workflowOid: d.workflow.oid
            },
            include
          })
      )
    );
  }

  private presentOutput(lines: string | string[]) {
    let array = (Array.isArray(lines) ? lines : lines.split('\n')).filter(Boolean);

    return array
      .map(line => {
        if (!line.startsWith('[')) return undefined!;
        let [ts, message] = JSON.parse(line);

        return {
          timestamp: ts,
          message
        };
      })
      .filter(Boolean);
  }

  async getWorkflowRunOutput(d: { run: WorkflowRun }) {
    let steps = await db.workflowRunStep.findMany({
      where: { runOid: d.run.oid },
      include: { step: { include: { artifactToDownload: true } } },
      orderBy: { index: 'asc' }
    });

    return Promise.all(
      steps.map(async step => {
        if (step.outputBucket && step.outputStorageKey) {
          let output = await storage.getObject(step.outputBucket, step.outputStorageKey);
          return {
            step,
            logs: this.presentOutput(output.data.toString('utf-8')),
            source: 'storage' as const
          };
        }

        let tempOutputs = await db.workflowRunOutputTemp.findMany({
          where: { stepOid: step.oid },
          orderBy: { createdAt: 'asc' }
        });

        return {
          step,
          logs: this.presentOutput(tempOutputs.flatMap(o => o.output.split('\n'))),
          source: 'temp' as const
        };
      })
    );
  }

  async getWorkflowRunOutputForStep(d: { run: WorkflowRun; stepId: string }) {
    let step = await db.workflowRunStep.findFirst({
      where: {
        id: d.stepId,
        runOid: d.run.oid
      }
    });
    if (!step) {
      throw new ServiceError(notFoundError('workflow.run.step'));
    }

    if (step.outputBucket && step.outputStorageKey) {
      let output = await storage.getObject(step.outputBucket, step.outputStorageKey);
      return {
        logs: this.presentOutput(output.data.toString('utf-8')),
        source: 'storage' as const
      };
    }

    let tempOutputs = await db.workflowRunOutputTemp.findMany({
      where: { stepOid: step.oid },
      orderBy: { createdAt: 'asc' }
    });

    return {
      logs: this.presentOutput(tempOutputs.map(o => o.output)),
      source: 'temp' as const
    };
  }
}

export let workflowRunService = Service.create(
  'workflowRunService',
  () => new workflowRunServiceImpl()
).build();
