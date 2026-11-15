import { checkEdition } from '@metorial/editions';

export let resolveSlateDeploymentConfig = (d: {
  manifest: PrismaJson.SlateJson;
  defaultMemorySizeMb: number;
  defaultTimeoutSeconds: number;
}) => ({
  memorySizeMb: d.defaultMemorySizeMb,
  timeoutSeconds: d.manifest.timeout ?? d.defaultTimeoutSeconds,
  disableNetworkIsolation: !checkEdition('on-prem') && d.manifest.networkIsolation !== true,
  concurrency: 'shared' as const
});
