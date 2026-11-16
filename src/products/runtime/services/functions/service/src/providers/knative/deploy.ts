import { assertNoReservedEnv, dropReservedEnv } from '../../lib/reservedEnv';
import type {
  ProviderCloneFunctionVersionParams,
  ProviderDeleteFunctionVersionParams,
  ProviderDeployFunctionParams
} from '../_lib';
import { getClusterManager, getClusterManagerErrorCode } from './clusterManager';
import {
  createKnativeProviderData,
  ensureKnativeFunction,
  entrypointFromHandler,
  importBundleFromUrl,
  type KnativeProviderData
} from './spec';

let tolerableSpeculativeErrors = new Set(['cluster_capacity', 'function_not_ready']);

let ensureSpeculatively = async (d: Parameters<typeof ensureKnativeFunction>[0]) => {
  try {
    await ensureKnativeFunction(d);
  } catch (err) {
    if (!tolerableSpeculativeErrors.has(getClusterManagerErrorCode(err) ?? '')) throw err;
    console.warn('Speculative function materialization failed', {
      functionVersionId: d.functionVersion.id,
      error: String(err)
    });
  }
};

export let deployFunction = async (d: ProviderDeployFunctionParams) => {
  assertNoReservedEnv(d.env);

  let bundle = await importBundleFromUrl({
    functionVersion: d.functionVersion,
    zipFileUrl: d.zipFileUrl
  });

  let providerData = await createKnativeProviderData({
    functionVersion: d.functionVersion,
    bundle,
    entrypoint: entrypointFromHandler(d.runtimeConfig.handler, 'module'),
    runtime: d.runtime,
    env: d.env
  });

  await ensureSpeculatively({
    mode: 'speculative',
    functionVersion: d.functionVersion,
    function: d.function,
    configuration: d.functionDeployment.configuration,
    providerData,
    env: d.env
  });

  return { providerData };
};

export let cloneFunctionVersion = async (d: ProviderCloneFunctionVersionParams) => {
  let source = d.sourceFunctionVersion.providerData as unknown as KnativeProviderData;

  return {
    providerData: await createKnativeProviderData({
      functionVersion: d.functionVersion,
      bundle: source.bundle,
      entrypoint: source.entrypoint,
      runtime: d.runtime,
      env: dropReservedEnv(d.env).env
    })
  };
};

export let deleteFunctionVersion = async (d: ProviderDeleteFunctionVersionParams) => {
  await getClusterManager().function.delete({ versionId: d.functionVersion.id });
};
