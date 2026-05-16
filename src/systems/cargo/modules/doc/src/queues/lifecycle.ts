import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { addAfterTransactionHook, db, env } from '@metorial-cargo/db';

type DocumentLifecycleEvent = 'created' | 'updated' | 'archived' | 'contents-changed';

let propagationDelayMs = 15_000;
let getLifecycleJobId = (documentId: string) => `document:${documentId}`;
let getPropagationJobOpts = (documentId: string) => ({
  id: getLifecycleJobId(documentId),
  delay: propagationDelayMs
});

export let documentLifecycleQueue = createQueue<{
  documentId: string;
  event: DocumentLifecycleEvent;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/doc/lifecycle/document',
  workerOpts: {
    concurrency: 10
  }
});

export let enqueueDocumentLifecycle = async (d: {
  documentId: string;
  event: DocumentLifecycleEvent;
}) => {
  await addAfterTransactionHook(async () => {
    await documentLifecycleQueue.add(d, {
      id: getLifecycleJobId(d.documentId)
    });
  });
};

export let documentLifecycleQueueProcessor = documentLifecycleQueue.process(async data => {
  await propagateDocumentDirtyQueue.add(
    { documentId: data.documentId },
    getPropagationJobOpts(data.documentId)
  );
});

let propagateDocumentDirtyQueue = createQueue<{
  documentId: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/doc/lifecycle/document/propDirty',
  workerOpts: {
    concurrency: 10
  }
});

export let propagateDocumentDirtyQueueProcessor = propagateDocumentDirtyQueue.process(
  async data => {
    await db.skillDestination.updateMany({
      where: {
        OR: [
          {
            skillPlugin: {
              skillPluginSkills: {
                some: {
                  skill: {
                    store: {
                      items: {
                        some: {
                          document: { id: data.documentId }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          {
            skillMarketplace: {
              plugins: {
                some: {
                  skillPlugin: {
                    skillPluginSkills: {
                      some: {
                        skill: {
                          store: {
                            items: {
                              some: {
                                document: { id: data.documentId }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        ]
      },
      data: {
        isDirty: true,
        lastTransientChangeAt: new Date()
      }
    });
  }
);

export let documentLifecycleProcessors = combineQueueProcessors([
  documentLifecycleQueueProcessor,
  propagateDocumentDirtyQueueProcessor
]);
