import { notFoundError, ServiceError } from '@lowerdeck/error';
import type { Instance, Organization, Project } from '@metorial/db';
import {
  consumerDeviceSettingsService,
  detectionDisabledError,
  deviceMonitor
} from '@metorial/module-consumer-core';
import { isAiToolDetectionFlagged } from '../../lib/aiToolDetection';

type DetectionContext = { organization: Organization; project: Project };

// Metorial Desktop stops collecting on this error, so it doubles as the flag gate.
export let requireDetectionReporting = async (ctx: DetectionContext) => {
  if (!(await isAiToolDetectionFlagged(ctx))) throw new ServiceError(detectionDisabledError());
};

export let requireDetectionCatalog = async (ctx: DetectionContext) => {
  if (!(await isAiToolDetectionFlagged(ctx))) {
    throw new ServiceError(notFoundError('consumer.device.detection_catalog'));
  }
};

export let getDeviceMonitor = async (ctx: DetectionContext & { instance: Instance }) => {
  let aiToolDetection =
    (await isAiToolDetectionFlagged(ctx)) &&
    (await consumerDeviceSettingsService.isAiToolDetectionEnabled({ instance: ctx.instance }));

  return deviceMonitor({ aiToolDetection });
};
