import { CodeBucket, Instance, LambdaServerInstance } from '@metorial/db';
import { codeBucketService } from '@metorial/module-code-bucket';
import { DeploymentError } from '../../base/error';

let commonEntryPoints = ['index', 'app', 'main', 'server', 'boot', 'mcp'].flatMap(name => [
  `${name}.ts`,
  `${name}.js`,
  `${name}.cjs`,
  `${name}.mjs`
]);

export let getPythonFs = async (
  lambda: LambdaServerInstance & {
    instance: Instance;
    immutableCodeBucket: CodeBucket;
  }
) => {
  let files = new Map(
    Object.entries({
      // TODO: @RahmeKarim add boot loader files for python here
      // 'boot.ts': bootTs,
      // 'delay.ts': delayTs,
      // 'discover.ts': discoverTs,
      // 'error.ts': errorTs,
      // 'logs.ts': logsTs,
      // 'promise.ts': promiseTs,
      // 'server.ts': serverTs,
      // 'transport.ts': transportTs,
      // 'lib/index.ts': libIndexTs,
      // 'lib/args.ts': libArgsTs,
      // 'lib/oauth.ts': libOauthTs,
      // 'lib/callbacks.ts': libCallbacksTs,
      // 'config.ts': configTs,
      // 'oauth.ts': oauthTs,
      // 'callbacks.ts': callbacksTs
    })
  );

  let bucketFiles = await codeBucketService.getCodeBucketFilesWithContent({
    codeBucket: lambda.immutableCodeBucket
  });

  for (let file of bucketFiles) {
    let path = `app/${file.path}`;
    if (files.has(path)) {
      throw new DeploymentError({
        code: 'invalid_file',
        message: `File ${file.path} is reserved and cannot be used in the code bucket`
      });
    }
    files.set(path, new TextDecoder().decode(file.content));
  }

  let entrypoint: string | undefined;
  if (!entrypoint) {
    let found = commonEntryPoints.find(name => bucketFiles.some(f => f.path === name));
    if (found) entrypoint = found;
  }
  if (!entrypoint) {
    throw new DeploymentError({
      code: 'missing_entry_point',
      message: `Could not determine entry point. Please specify a "main" field in your package.json file or add one of the following files to your code bucket: ${commonEntryPoints.join(
        ', '
      )}`
    });
  }

  let metorialDeploymentContent = JSON.stringify(
    {
      entrypoint,
      lambda: {
        id: lambda.id,
        createdAt: lambda.createdAt
      },
      immutableCodeBucket: {
        id: lambda.immutableCodeBucket.id,
        createdAt: lambda.immutableCodeBucket.createdAt
      },
      instance: {
        id: lambda.instance.id,
        slug: lambda.instance.slug,
        name: lambda.instance.name,
        type: lambda.instance.type,
        createdAt: lambda.instance.createdAt
      }
    },
    null,
    2
  );
  files.set('mtdpl.json', metorialDeploymentContent);

  return {
    entrypoint: 'boot.py', // TODO: @RahmeKarim change to what the entrypoint should be
    env: {
      CUSTOM_SERVER_ENTRYPOINT: entrypoint
    },
    files
  };
};
