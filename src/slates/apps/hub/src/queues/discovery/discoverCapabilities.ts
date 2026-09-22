import type { SlateVersion } from '../../../prisma/generated/client';
import type { SlateInvocationDeploymentTarget } from '../../lib/invocation/types';
import { slateInvocationService } from '../../services';

export let discoverSlateCapabilities = async (d: {
  slateVersion: SlateVersion;
  deploymentTarget: SlateInvocationDeploymentTarget;
  suppressServerErrorReporting?: boolean;
}): Promise<PrismaJson.SlateCapabilities & { capabilitiesSupported: boolean }> => {
  try {
    let stack = await slateInvocationService.createInvocation({
      slateVersion: d.slateVersion,
      deploymentTarget: d.deploymentTarget,
      participants: [], // Only the hub
      suppressServerErrorReporting: d.suppressServerErrorReporting
    });

    let result = await slateInvocationService.getProviderCapabilities({ stack });
    if (result.status === 'error')
      return {
        capabilitiesSupported: false
      };

    return {
      ...(result.data.capabilities ?? {}),
      capabilitiesSupported: true
    };
  } catch (e) {
    console.error('Error discovering slate capabilities:', e);
    return {
      capabilitiesSupported: false
    };
  }
};
