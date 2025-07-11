import { addRunSyncsForSession } from '../../queues/syncRuns';
import { addSessionSync } from '../../queues/syncSessions';

export let forceSync = async (data: { engineSessionId: string }) => {
  await addSessionSync({ engineSessionId: data.engineSessionId });
  await addRunSyncsForSession({ engineSessionId: data.engineSessionId });
};
