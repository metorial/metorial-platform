import { CodeBucket, Instance, LambdaServerInstance } from '@metorial/db';
import { codeBucketService } from '@metorial/module-code-bucket';
import { v } from '@metorial/validation';
import { DeploymentError } from '../../base/error';
import { bootstrapPy } from './__metorial__/bootstrap.py';
import { callbacksPy } from './__metorial__/callbacks.py';
import { configPy } from './__metorial__/config.py';
import { metorialPy } from './__metorial__/metorial.py';
import { oauthPy } from './__metorial__/oauth.py';
import { utilsPy } from './__metorial__/lib/utils.py';
import { indexPy } from './index.py';
import { requirementsTxt } from './requirements.txt';

let commonEntryPoints = ['server.py', 'main.py', 'index.py', 'app.py'];

export let getPythonFs = async (
  lambda: LambdaServerInstance & {
    instance: Instance;
    immutableCodeBucket: CodeBucket;
  }
) => {
  let files = new Map(
    Object.entries({
      'index.py': indexPy,
      'metorial.py': metorialPy,
      '__metorial__/__init__.py': '',
      '__metorial__/bootstrap.py': bootstrapPy,
      '__metorial__/callbacks.py': callbacksPy,
      '__metorial__/config.py': configPy,
      '__metorial__/oauth.py': oauthPy,
      '__metorial__/lib/__init__.py': '',
      '__metorial__/lib/utils.py': utilsPy
    })
  );

  let bucketFiles = await codeBucketService.getCodeBucketFilesWithContent({
    codeBucket: lambda.immutableCodeBucket
  });

  let metorialJsonFile = bucketFiles.find(f => f.path === 'metorial.json');
  let metorialJson = {
    runtime: 'python'
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
        runtime: v.literal('python'),
        entrypoint: v.optional(v.string())
      })
      .validate(metorialJson);
    if (!valid.success) {
      throw new DeploymentError({
        code: 'invalid_metorial_json',
        message: 'Invalid metorial.json file: ' + valid.errors.map(e => e.message).join(', ')
      });
    }
  }

  let requirementsFile = bucketFiles.find(f => f.path === 'requirements.txt');
  let existingRequirements = '';
  if (requirementsFile) {
    existingRequirements = new TextDecoder().decode(requirementsFile.content);
  }

  let entrypoint = (metorialJson as any).entrypoint;
  if (!entrypoint) {
    let found = commonEntryPoints.find(name => bucketFiles.some(f => f.path === name));
    if (found) entrypoint = found;
  }
  if (!entrypoint) {
    throw new DeploymentError({
      code: 'missing_entry_point',
      message: `Could not determine entry point. Please specify an "entrypoint" field in your metorial.json file or add one of the following files to your code bucket: ${commonEntryPoints.join(
        ', '
      )}`
    });
  }

  for (let file of bucketFiles) {
    if (!file.path) continue;
    
    if (file.path.startsWith('__metorial__/')) {
      throw new DeploymentError({
        code: 'invalid_file',
        message: `File ${file.path} is reserved and cannot be used in the code bucket`
      });
    }

    if (file.path === 'metorial.json' || file.path === 'requirements.txt') {
      continue;
    }

    files.set(file.path, new TextDecoder().decode(file.content));
  }

  let finalRequirements = existingRequirements.trim();
  if (!finalRequirements.includes('mcp')) {
    if (finalRequirements) {
      finalRequirements += '\n';
    }
    finalRequirements += requirementsTxt;
  }
  files.set('requirements.txt', finalRequirements);

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
    entrypoint: 'index.lambda_handler',
    env: {
      METORIAL_ENTRYPOINT: entrypoint
    },
    files
  };
};

