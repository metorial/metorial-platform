import { delay } from '@lowerdeck/delay';
import type {
  ServerDeployment,
  ServerDeploymentStep,
  ServerDeploymentStepType
} from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';

export class DeploymentManagerStep {
  #flushInterval: NodeJS.Timeout | null = null;
  #logs: { ts: number; logs: string[] }[] = [];

  private constructor(public readonly step: ServerDeploymentStep) {}

  static async of(opts: { step: ServerDeploymentStep } | { stepId: string }) {
    if ('stepId' in opts) {
      let step = await db.serverDeploymentStep.findFirst({
        where: { id: opts.stepId }
      });
      for (let i = 0; i < 30; i++) {
        if (step) return new DeploymentManagerStep(step);

        await delay(100);

        step = await db.serverDeploymentStep.findFirst({
          where: { id: opts.stepId }
        });
      }

      throw new Error('Deployment step not found');
    } else {
      return new DeploymentManagerStep(opts.step);
    }
  }

  log(logs: string[] | string) {
    if (Array.isArray(logs)) {
      if (logs.length === 0) return;
      this.#logs.push({ ts: Date.now(), logs: logs as string[] });
    } else {
      this.#logs.push({ ts: Date.now(), logs: [logs] });
    }

    this.queueFlushLogs();
  }

  async succeed() {
    await this.end('succeeded');
  }

  async fail() {
    await this.end('failed');
  }

  private async end(status: 'succeeded' | 'failed') {
    await this.flushLogs();

    await db.serverDeploymentStep.update({
      where: { oid: this.step.oid },
      data: {
        status,
        endedAt: new Date()
      }
    });
  }

  private queueFlushLogs() {
    if (this.#flushInterval) return;

    this.#flushInterval = setInterval(async () => {
      this.#flushInterval = null;
      await this.flushLogs();
    }, 2000);
  }

  private async flushLogs() {
    this.#flushInterval = null;
    if (this.#logs.length === 0) return;

    let toAppend = this.#logs;
    this.#logs = [];

    await db.serverDeploymentStep.update({
      where: { oid: this.step.oid },
      data: {
        logs: {
          push: toAppend.flatMap(l => l.logs.map(log => [l.ts, log] as [number, string]))
        }
      }
    });
  }
}

export class DeploymentManager {
  private constructor(public readonly serverDeployment: ServerDeployment) {}

  static async of(
    opts: { serverDeploymentId: string } | { serverDeployment: ServerDeployment }
  ) {
    let serverDeployment: ServerDeployment;
    if ('serverDeploymentId' in opts) {
      let sd = await db.serverDeployment.findFirst({
        where: { id: opts.serverDeploymentId }
      });
      let i = 0;
      while (true) {
        if (sd) break;
        await delay(1000);

        sd = await db.serverDeployment.findFirst({
          where: { id: opts.serverDeploymentId }
        });

        if (i++ > 30) throw new Error('Server deployment not found');
      }

      serverDeployment = sd;
    } else {
      serverDeployment = opts.serverDeployment;
    }

    return new DeploymentManager(serverDeployment);
  }

  async step(type: ServerDeploymentStepType) {
    let step = await db.serverDeploymentStep.create({
      data: {
        ...getId('serverDeploymentStep'),
        deploymentOid: this.serverDeployment.oid,
        type,
        status: 'running',
        startedAt: new Date()
      }
    });

    return await DeploymentManagerStep.of({
      step
    });
  }
}
