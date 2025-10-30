import { CreateLogGroupCommand } from '@aws-sdk/client-cloudwatch-logs';
import { awsLogs } from './aws';

let ensureLogGroupRaw = async (logGroup: string) => {
  try {
    await awsLogs.send(new CreateLogGroupCommand({ logGroupName: logGroup }));
  } catch (err: any) {
    if (!err.name.includes('ResourceAlreadyExists')) throw err;
  }
};

let logGroupPromiseCache = new Map<string, ReturnType<typeof ensureLogGroupRaw>>();

export let ensureLogGroup = async (logGroup: string) => {
  let promise = logGroupPromiseCache.get(logGroup);

  if (!promise) {
    promise = ensureLogGroupRaw(logGroup);
    logGroupPromiseCache.set(logGroup, promise);
  }

  return await promise;
};
