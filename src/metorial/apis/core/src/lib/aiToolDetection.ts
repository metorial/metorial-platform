import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import type {
  ConsumerDeviceConnectionMode,
  ConsumerDeviceSettings,
  Organization,
  Project
} from '@metorial/db';
import type { AuthInfo } from '@metorial/module-access';
import {
  aiToolDetectionFlag,
  consumerDeviceSettingsService,
  detectionDisabledError,
  deviceMonitor
} from '@metorial/module-consumer-core';
import type { BooleanFlagKey } from '@metorial/module-flags';
import { isHumanDashboardUser } from './dashboardUser';

export let deviceFlags: BooleanFlagKey[] = [
  'paid-portals',
  'portals-access',
  'devices-enabled'
];

export let aiToolDetectionFlags: BooleanFlagKey[] = [...deviceFlags, aiToolDetectionFlag];

type DetectionContext = { organization: Organization; project: Project };

type DeviceSettingsInput = {
  aiToolDetectionEnabled?: boolean;
  privacyNoticeAccepted?: boolean;
  connectionMode?: ConsumerDeviceConnectionMode;
};

// Metorial Desktop stops collecting on this error, so it doubles as the flag gate.
export let requireDetectionReporting = async (ctx: DetectionContext) => {
  if (!(await consumerDeviceSettingsService.isAiToolDetectionFlagged(ctx))) {
    throw new ServiceError(detectionDisabledError());
  }
};

export let assertDetectionSettingsAvailable = async (
  ctx: DetectionContext,
  input: DeviceSettingsInput
) => {
  if (
    input.aiToolDetectionEnabled === undefined &&
    input.privacyNoticeAccepted === undefined
  ) {
    return;
  }
  if (await consumerDeviceSettingsService.isAiToolDetectionFlagged(ctx)) return;

  throw new ServiceError(
    forbiddenError({ message: 'AI tool detection isn’t available for this organization.' })
  );
};

export let requireDetectionCatalog = async (ctx: DetectionContext) => {
  if (!(await consumerDeviceSettingsService.isAiToolDetectionFlagged(ctx))) {
    throw new ServiceError(notFoundError('consumer.device.detection_catalog'));
  }
};

export let getDeviceMonitor = async (
  ctx: DetectionContext,
  settings: Pick<ConsumerDeviceSettings, 'aiToolDetectionEnabled'> | null
) =>
  deviceMonitor({
    aiToolDetection:
      !!settings?.aiToolDetectionEnabled &&
      (await consumerDeviceSettingsService.isAiToolDetectionFlagged(ctx))
  });

// Device reads only load detections while the instance setting is on; this also hides them
// while the feature isn't available to the organization.
export let withVisibleDetections = <ConsumerDevice extends { detections: unknown[] }>(
  consumerDevice: ConsumerDevice,
  visible: boolean
): ConsumerDevice => (visible ? consumerDevice : { ...consumerDevice, detections: [] });

// Accepting the privacy notice, turning detection on and letting AI tools connect directly
// (which writes connection secrets into their config files) are decisions a person makes in
// the dashboard, never an API key; undoing any of them stays open.
export let assertCanTurnOnDeviceSettings = (
  ctx: { auth: AuthInfo },
  input: DeviceSettingsInput
) => {
  if (
    !input.aiToolDetectionEnabled &&
    !input.privacyNoticeAccepted &&
    input.connectionMode != 'direct'
  ) {
    return;
  }
  if (isHumanDashboardUser(ctx.auth)) return;

  throw new ServiceError(
    forbiddenError({
      message:
        'Only a signed-in dashboard user can accept the privacy notice, turn on AI tool detection or let AI tools connect directly.'
    })
  );
};
