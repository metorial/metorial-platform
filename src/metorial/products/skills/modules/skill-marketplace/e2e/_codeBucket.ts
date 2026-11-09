import { Server as GrpcServer, ServerCredentials } from '@grpc/grpc-js';
import { CodeBucketService } from '@metorial/code-bucket-service-generated/ts-proto-gen/rpc';
import { getStorage } from '@metorial/module-file';
import { afterAll, beforeAll } from 'vitest';

export type FakeCodeBucketCall = { method: string; bucketId: string; paths: string[] };

let toBucketPath = (path: string) => path.replace(/^\/+/, '');

let isWithinBucketPrefix = (path: string, prefix: string) => {
  let normalized = prefix.replace(/^\/+|\/+$/g, '');
  return !normalized || path === normalized || path.startsWith(`${normalized}/`);
};

// The e2e stack runs no code-bucket service, so CODE_BUCKET_SERVICE_URL (localhost:5050) is free
// in the network namespace the runner shares with the stack. Serving a fake there lets both the
// in-process services and the stack worker run legacy syncs; it mirrors Origin's prune semantics.
export let useFakeCodeBucket = () => {
  let buckets = new Map<string, Map<string, Buffer>>();
  let calls: FakeCodeBucketCall[] = [];
  let server: GrpcServer | undefined;

  let bucket = (bucketId: string) => {
    let files = buckets.get(bucketId);
    if (!files) {
      files = new Map();
      buckets.set(bucketId, files);
    }
    return files;
  };

  let prune = (d: {
    bucketId: string;
    prefix: string;
    keepPaths: string[];
    excludePrefixes: string[];
  }) => {
    let files = bucket(d.bucketId);
    let keep = new Set(d.keepPaths.map(toBucketPath));
    let deleted = [...files.keys()].filter(
      path =>
        isWithinBucketPrefix(path, d.prefix) &&
        !keep.has(path) &&
        !d.excludePrefixes.some(prefix => isWithinBucketPrefix(path, prefix))
    );
    for (let path of deleted) files.delete(path);
    return deleted.map(path => `/${path}`);
  };

  let record = (method: string, bucketId: string, paths: string[]) =>
    calls.push({ method, bucketId, paths: paths.map(toBucketPath) });

  let unary = (handler: (request: any) => Promise<unknown>) => (call: any, callback: any) => {
    handler(call.request).then(
      result => callback(null, result),
      error => callback({ code: 13, details: String(error?.message ?? error) })
    );
  };

  let handlers = {
    setBucketFiles: unary(async request => {
      for (let file of request.files) {
        bucket(request.bucketId).set(toBucketPath(file.path), Buffer.from(file.content));
      }
      record(
        'setBucketFiles',
        request.bucketId,
        request.files.map((file: { path: string }) => file.path)
      );
      return {};
    }),
    setBucketFile: unary(async request => {
      bucket(request.bucketId).set(toBucketPath(request.path), Buffer.from(request.content));
      record('setBucketFile', request.bucketId, [request.path]);
      return {};
    }),
    copyBucketFiles: unary(async request => {
      for (let file of request.files) {
        let object = await getStorage().getObject(file.sourceBucket, file.sourceKey);
        bucket(request.bucketId).set(toBucketPath(file.path), Buffer.from(object.data));
      }
      let paths = request.files.map((file: { path: string }) => file.path);
      record('copyBucketFiles', request.bucketId, paths);
      return { copiedPaths: paths };
    }),
    deleteBucketFile: unary(async request => {
      bucket(request.bucketId).delete(toBucketPath(request.path));
      record('deleteBucketFile', request.bucketId, [request.path]);
      return {};
    }),
    deleteBucketPath: unary(async request => {
      let deletedPaths = prune({
        bucketId: request.bucketId,
        prefix: request.path,
        keepPaths: [],
        excludePrefixes: []
      });
      record('deleteBucketPath', request.bucketId, deletedPaths);
      return { deletedPaths };
    }),
    pruneBucketPath: unary(async request => {
      let deletedPaths = prune(request);
      record('pruneBucketPath', request.bucketId, deletedPaths);
      return { deletedPaths };
    })
  };

  beforeAll(async () => {
    let address = process.env.CODE_BUCKET_SERVICE_URL ?? 'localhost:5050';
    let port = address.split(':').at(-1);

    server = new GrpcServer();
    server.addService(CodeBucketService as any, handlers);
    await new Promise<void>((resolve, reject) =>
      server!.bindAsync(`localhost:${port}`, ServerCredentials.createInsecure(), error =>
        error ? reject(error) : resolve()
      )
    );
  });

  afterAll(() => {
    server?.forceShutdown();
  });

  return {
    calls,
    callsFor: (bucketId: string | null) => calls.filter(call => call.bucketId === bucketId),
    writesFor: (bucketId: string | null) =>
      calls.filter(
        call =>
          call.bucketId === bucketId &&
          ['setBucketFiles', 'setBucketFile', 'copyBucketFiles'].includes(call.method)
      ),
    files: (bucketId: string | null) => new Map(bucketId ? bucket(bucketId) : [])
  };
};
