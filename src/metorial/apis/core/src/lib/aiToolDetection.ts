import type { Organization, Project } from '@metorial/db';
import { flagService } from '@metorial/module-flags';

export let isAiToolDetectionFlagged = (ctx: {
  organization: Organization;
  project: Project;
}) =>
  flagService.isFlagEnabledForScope({
    organization: ctx.organization,
    project: ctx.project,
    flag: 'ai-tool-detection'
  });

// Device reads only load detections while the instance setting is on; this also hides them
// while the feature isn't available to the organization.
export let withVisibleDetections = <ConsumerDevice extends { detections: unknown[] }>(
  consumerDevice: ConsumerDevice,
  visible: boolean
): ConsumerDevice => (visible ? consumerDevice : { ...consumerDevice, detections: [] });
