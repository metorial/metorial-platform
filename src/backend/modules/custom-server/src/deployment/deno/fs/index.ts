import { CodeBucket, Instance, LambdaServerInstance } from '@metorial/db';
import { codeBucketService } from '@metorial/module-code-bucket';
import { v } from '@metorial/validation';
import { DeploymentError } from '../../base/error';
import { bootTs } from './boot';
import { callbacksTs } from './callbacks';
import { configTs } from './config';
import { delayTs } from './delay';
import { discoverTs } from './discover';
import { errorTs } from './error';
import { libArgsTs } from './lib/args';
import { libCallbacksTs } from './lib/callbacks';
import { libIndexTs } from './lib/lib';
import { libOauthTs } from './lib/oauth';
import { logsTs } from './logs';
import { oauthTs } from './oauth';
import { promiseTs } from './promise';
import { serverTs } from './server';
import { transportTs } from './transport';

let commonEntryPoints = ['index', 'app', 'main', 'server', 'boot', 'mcp'].flatMap(name => [
  `${name}.ts`,
  `${name}.js`,
  `${name}.cjs`,
  `${name}.mjs`
]);

export let getDenoFs = async (
  lambda: LambdaServerInstance & {
    instance: Instance;
    immutableCodeBucket: CodeBucket;
  }
) => {
  let files = new Map(
    Object.entries({
      'boot.ts': bootTs,
      'delay.ts': delayTs,
      'discover.ts': discoverTs,
      'error.ts': errorTs,
      'logs.ts': logsTs,
      'promise.ts': promiseTs,
      'server.ts': serverTs,
      'transport.ts': transportTs,
      'lib/index.ts': libIndexTs,
      'lib/args.ts': libArgsTs,
      'lib/oauth.ts': libOauthTs,
      'lib/callbacks.ts': libCallbacksTs,
      'config.ts': configTs,
      'oauth.ts': oauthTs,
      'callbacks.ts': callbacksTs
    })
  );

  let bucketFiles = await codeBucketService.getCodeBucketFilesWithContent({
    codeBucket: lambda.immutableCodeBucket
  });

  let metorialJsonFile = bucketFiles.find(f => f.path === 'metorial.json');
  let metorialJson = {
    runtime: 'typescript.deno'
  };
  if (metorialJsonFile) {
    try {
      metorialJson = JSON.parse(new TextDecoder().decode(metorialJsonFile.content));
    } catch (e) {
      throw new DeploymentError({
        code: 'invalid_metorial_json',
        message: 'Unable to parse metorial.json file'
      });
    }

    let valid = v
      .object({
        runtime: v.literal('typescript.deno')
      })
      .validate(metorialJson);
    if (!valid.success) {
      throw new DeploymentError({
        code: 'invalid_metorial_json',
        message: 'Invalid metorial.json file: ' + valid.errors.map(e => e.message).join(', ')
      });
    }
  }

  let packageJsonFile = bucketFiles.find(f => f.path === 'package.json');
  let packageJson: any = {};
  if (packageJsonFile) {
    try {
      packageJson = JSON.parse(new TextDecoder().decode(packageJsonFile.content));
    } catch (e) {
      throw new DeploymentError({
        code: 'invalid_package_json',
        message: 'Unable to parse package.json file'
      });
    }

    let valid = v
      .object({
        name: v.optional(v.string()),
        version: v.optional(v.string()),
        main: v.optional(v.string()),
        dependencies: v.optional(v.record(v.string())),
        devDependencies: v.optional(v.record(v.string()))
      })
      .validate(packageJson);
    if (!valid.success) {
      throw new DeploymentError({
        code: 'invalid_package_json',
        message: 'Invalid package.json file: ' + valid.errors.map(e => e.message).join(', ')
      });
    }
  } else {
    throw new DeploymentError({
      code: 'missing_package_json',
      message: 'Missing package.json file'
    });
  }

  if (metorialJson.runtime !== 'typescript.deno') {
    throw new DeploymentError({
      code: 'invalid_runtime',
      message: 'Only typescript.deno runtime is supported'
    });
  }

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

  let entrypoint = packageJson.main;
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

  let finalPackageJson = {
    ...packageJson,
    main: 'server.ts',
    dependencies: {
      '@modelcontextprotocol/sdk': 'latest',
      zod: 'latest',
      metorial: 'latest'
    }
  };
  files.set('package.json', JSON.stringify(finalPackageJson, null, 2));

  let denoJson = {
    imports: {
      '@metorial/mcp-server-sdk': './lib/index.ts'
    }
  };
  files.set('deno.json', JSON.stringify(denoJson, null, 2));

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
    entrypoint: 'boot.ts',
    env: {
      CUSTOM_SERVER_ENTRYPOINT: entrypoint
    },
    files
  };
};
