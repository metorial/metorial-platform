import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import type { Instance, Organization, Project } from '@metorial/db';
import type { AuthInfo } from '@metorial/module-access';
import {
  aiToolDetectionFlag,
  consumerDeviceSettingsService,
  detectionDisabledError,
  deviceMonitor
} from '@metorial/module-consumer-core';
import type { BooleanFlagKey } from '@metorial/module-flags';
import { isHumanDashboardUser } from './aiToolActivity';

export let aiToolDetectionFlags: BooleanFlagKey[] = [
  'paid-portals',
  'portals-access',
  'devices-enabled',
  aiToolDetectionFlag
];

type DetectionContext = { organization: Organization; project: Project };

// Metorial Desktop stops collecting on this error, so it doubles as the flag gate.
export let requireDetectionReporting = async (ctx: DetectionContext) => {
  if (!(await consumerDeviceSettingsService.isAiToolDetectionFlagged(ctx))) {
    throw new ServiceError(detectionDisabledError());
  }
};

export let requireDetectionCatalog = async (ctx: DetectionContext) => {
  if (!(await consumerDeviceSettingsService.isAiToolDetectionFlagged(ctx))) {
    throw new ServiceError(notFoundError('consumer.device.detection_catalog'));
  }
};

export let getDeviceMonitor = async (ctx: DetectionContext & { instance: Instance }) =>
  deviceMonitor({
    aiToolDetection: await consumerDeviceSettingsService.isAiToolDetectionActive(ctx)
  });

// Device reads only load detections while the instance setting is on; this also hides them
// while the feature isn't available to the organization.
export let withVisibleDetections = <ConsumerDevice extends { detections: unknown[] }>(
  consumerDevice: ConsumerDevice,
  visible: boolean
): ConsumerDevice => (visible ? consumerDevice : { ...consumerDevice, detections: [] });

// Accepting the privacy notice and turning detection on are decisions a person makes in the
// dashboard, never an API key; turning either off stays open.
export let assertCanTurnOnDetection = (
  ctx: { auth: AuthInfo },
  input: { aiToolDetectionEnabled?: boolean; privacyNoticeAccepted?: boolean }
) => {
  if (!input.aiToolDetectionEnabled && !input.privacyNoticeAccepted) return;
  if (isHumanDashboardUser(ctx.auth)) return;

  throw new ServiceError(
    forbiddenError({
      message:
        'Only a signed-in dashboard user can accept the privacy notice or turn on AI tool detection.'
    })
  );
};
