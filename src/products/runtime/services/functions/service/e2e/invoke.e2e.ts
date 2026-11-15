import { createServer } from 'http';
import JSZip from 'jszip';
import type { AddressInfo } from 'net';
import { afterAll, describe, expect, it } from 'vitest';
import type { FunctionVersion } from '../prisma/generated/client';
import { db } from '../src/db';
import { env } from '../src/env';
import { getId } from '../src/id';
import { defaultProvider } from '../src/providers';
import { functionBay } from './client';
import {
  createBundle,
  createDeployment,
  createFunction,
  createTenant,
  type ProviderIdentifier
} from './fixtures';

let handlers: Record<Exclude<ProviderIdentifier, 'aws.lambda'>, string> = {
  local: `exports.handler = async event => {
  console.log('hello from e2e');
  if (event.payload.fail) throw new Error('requested failure');
  return { statusCode: 200, body: { result: { echo: event.payload, greeting: process.env.GREETING } } };
};
`,
  knative: `exports.handler = async payload => {
  console.log('hello from e2e');
  if (payload.fail) throw new Error('requested failure');
  return { echo: payload, greeting: process.env.GREETING };
};
`
};

let providerIdentifier = env.provider.DEFAULT_PROVIDER;

let serveZip = async (zip: Buffer) => {
  let server = createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'application/zip' });
    res.end(zip);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/bundle.zip`,
    close: () => new Promise<void>(resolve => server.close(() => resolve()))
  };
};

let deployedVersions: FunctionVersion[] = [];

let deployEchoFunction = async () => {
  let handler = handlers[providerIdentifier as keyof typeof handlers];

  let zip = new JSZip();
  zip.file('index.js', handler);
  let served = await serveZip(await zip.generateAsync({ type: 'nodebuffer' }));

  try {
    let tenant = await createTenant();
    let spec = { identifier: 'nodejs', version: '24.x' } as const;
    let runtime = await defaultProvider.getRuntime(spec);
    let func = await createFunction({
      tenantOid: tenant.oid,
      runtimeOid: runtime.runtime.oid
    });
    let deployment = await createDeployment({
      functionOid: func.oid,
      runtimeOid: runtime.runtime.oid
    });
    let configuration = { memorySizeMb: 256, timeoutSeconds: 30 };
    let versionIds = getId('functionVersion');

    let { providerData } = await defaultProvider.deployFunction({
      functionVersion: { id: versionIds.id },
      function: func,
      functionDeployment: deployment,
      runtimeConfig: {
        layer: runtime.layer,
        runtime: spec,
        handler: 'index.handler',
        identifier: runtime.identifier
      },
      runtime: runtime.runtime,
      env: { GREETING: 'hello e2e' },
      zipFileUrl: served.url
    });

    let bundle = await createBundle({ functionOid: func.oid });
    let version = await db.functionVersion.create({
      data: {
        ...versionIds,
        status: 'active',
        identifier: versionIds.id,
        name: `Version ${versionIds.id}`,
        supportsV2Proxy: true,
        functionOid: func.oid,
        runtimeOid: runtime.runtime.oid,
        functionBundleOid: bundle.oid,
        encryptedEnvironmentVariables: providerData.encryptedEnvironmentVariables,
        configuration,
        providerData,
        manifest: { entrypoint: 'index.handler', files: ['index.js'] }
      }
    });
    deployedVersions.push(version);

    await db.function.update({
      where: { oid: func.oid },
      data: { currentVersionOid: version.oid }
    });

    return { tenant, function: func, version };
  } finally {
    await served.close();
  }
};

describe.skipIf(providerIdentifier == 'aws.lambda')(
  `function-bay invocation (${providerIdentifier})`,
  () => {
    afterAll(async () => {
      for (let functionVersion of deployedVersions) {
        await defaultProvider.deleteFunctionVersion({ functionVersion });
      }
    });

    it('deploys a bundle and invokes it with its environment', async () => {
      let deployed = await deployEchoFunction();

      let result = await functionBay.function.invoke({
        tenantId: deployed.tenant.id,
        functionId: deployed.function.id,
        payload: { message: 'ping' }
      });

      expect(result).toMatchObject({
        type: 'success',
        status: 'succeeded',
        functionVersionId: deployed.version.id,
        result: { echo: { message: 'ping' }, greeting: 'hello e2e' }
      });
      expect(result.logs.map(log => log.message)).toEqual(
        expect.arrayContaining([expect.stringContaining('hello from e2e')])
      );
      expect(result.computeTimeMs).toBeGreaterThanOrEqual(0);
    }, 180_000);

    it('reports a handler failure as a failed invocation', async () => {
      let deployed = await deployEchoFunction();

      let result = await functionBay.function.invoke({
        tenantId: deployed.tenant.id,
        functionId: deployed.function.id,
        payload: { fail: true }
      });

      expect(result).toMatchObject({
        type: 'error',
        status: 'failed',
        functionVersionId: deployed.version.id,
        error: {
          code: expect.any(String),
          message: expect.stringContaining('requested failure')
        }
      });
    }, 180_000);
  }
);
