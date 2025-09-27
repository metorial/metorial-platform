import {
  CustomServerDeployment,
  CustomServerDeploymentStep,
  CustomServerDeploymentStepStatus,
  CustomServerDeploymentStepType,
  db,
  ID
} from '@metorial/db';

export type Logs = {
  lines: string[];
  type?: 'info' | 'error';
}[];

export let createDeploymentStepManager = (opts: { deployment: CustomServerDeployment }) => {
  let indexRef = { current: 0 };

  return {
    createDeploymentStep: async (d: {
      type: CustomServerDeploymentStepType;
      status?: CustomServerDeploymentStepStatus;
      log?: Logs;
    }) => {
      let upsertLogs = (current: CustomServerDeploymentStep | undefined, logs: Logs) => {
        let currentLogs = current?.logs || [];

        for (let log of logs) {
          currentLogs.push([
            Date.now(),
            log.lines,
            ...(log.type == 'error' ? [1] : [])
          ] as any);
        }

        if (current) current.logs = currentLogs;

        return currentLogs;
      };

      let step = await db.customServerDeploymentStep.create({
        data: {
          id: await ID.generateId('customServerDeploymentStep'),
          type: d.type,
          status: d.status ?? 'running',
          index: indexRef.current++,
          deploymentOid: opts.deployment.oid,
          startedAt: new Date(),
          endedAt: d.status == 'completed' ? new Date() : null,
          logs: upsertLogs(undefined, d.log || [])
        }
      });

      let setStatus = async (status: CustomServerDeploymentStepStatus, logs?: Logs) => {
        if (step.status != 'running') return;

        step.status = status;
        step.endedAt = new Date();
        if (logs) step.logs = upsertLogs(step, logs);

        await db.customServerDeploymentStep.updateMany({
          where: { oid: step.oid },
          data: {
            status: step.status,
            endedAt: step.endedAt,
            logs: step.logs ?? undefined
          }
        });
      };

      return {
        step,
        complete: (logs?: Logs) => setStatus('completed', logs),
        fail: (logs?: Logs) => setStatus('failed', logs),
        addLog: async (log: string[], type?: 'info' | 'error') => {
          let updatedLogs = upsertLogs(step, [{ type, lines: log }]);

          await db.customServerDeploymentStep.updateMany({
            where: { id: step.id },
            data: { logs: updatedLogs }
          });
        }
      };
    }
  };
};
