import { sessionClassifyQueue } from '../queues/sessionClassify';
import { getStore } from '@mtsrc/agent-tracking-store';
import { shouldClassify, type ClassificationReason } from './policy';

export type { ClassificationReason } from './policy';

export let maybeClassifySession = async (d: {
  sessionKey: string;
  reason: ClassificationReason;
}) => {
  if (d.reason != 'manual') {
    let store = getStore();
    await store.ready();

    let session = await store
      .collections()
      .sessions.findOne(
        { _id: d.sessionKey },
        { projection: { classification: 1, context: 1 } }
      );
    if (!session || !shouldClassify({ session, reason: d.reason })) return false;
  }

  await sessionClassifyQueue.add(
    { sessionKey: d.sessionKey, reason: d.reason },
    { id: d.reason == 'manual' ? `manual-${d.sessionKey}` : d.sessionKey }
  );

  return true;
};
