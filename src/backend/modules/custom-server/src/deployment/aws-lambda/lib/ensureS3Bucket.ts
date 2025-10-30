import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketVersioningCommand,
  PutPublicAccessBlockCommand
} from '@aws-sdk/client-s3';
import { awsS3 } from './aws';

let ensureS3BucketRaw = async (bucketName: string) => {
  try {
    await awsS3.send(new HeadBucketCommand({ Bucket: bucketName }));
    return bucketName;
  } catch (err: any) {
    if (!err.name?.includes('NotFound')) throw err;
  }

  let createParams: any = {
    Bucket: bucketName,
    ACL: 'private'
  };

  try {
    await awsS3.send(new CreateBucketCommand(createParams));

    await awsS3.send(
      new PutBucketVersioningCommand({
        Bucket: bucketName,
        VersioningConfiguration: {
          Status: 'Enabled'
        }
      })
    );

    await awsS3.send(
      new PutPublicAccessBlockCommand({
        Bucket: bucketName,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true
        }
      })
    );
  } catch (err: any) {
    if (!err.message.includes('BucketAlreadyOwnedByYou')) throw err;
  }

  return bucketName;
};

let bucketPromiseCache = new Map<string, ReturnType<typeof ensureS3BucketRaw>>();

export let ensureS3Bucket = async (bucketName: string) => {
  let promise = bucketPromiseCache.get(bucketName);

  if (!promise) {
    promise = ensureS3BucketRaw(bucketName);
    bucketPromiseCache.set(bucketName, promise);
  }

  return await promise;
};
