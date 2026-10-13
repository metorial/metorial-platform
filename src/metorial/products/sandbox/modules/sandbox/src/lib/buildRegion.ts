import type { SandboxRegion } from '@metorial/db';
import { env } from '../env';

let BUILD_REGION_IDS: Record<string, string> = {
  eu1: 'aws:eu-west-1',
  us1: 'aws:us-east-1'
};

export let resolveBuildRegion = (regions: SandboxRegion[]): SandboxRegion | undefined => {
  let preferredId = env.service.METORIAL_REGION
    ? BUILD_REGION_IDS[env.service.METORIAL_REGION]
    : undefined;

  return (
    regions.find(region => region.id == preferredId) ??
    [...regions].sort((a, b) => a.id.localeCompare(b.id))[0]
  );
};
