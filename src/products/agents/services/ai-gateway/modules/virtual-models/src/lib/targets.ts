import { weightedOrder } from '@mtsrc/ai-gateway-module-routing';
import type { RequestSummary } from '@mtsrc/ai-gateway-request-features';
import type { VirtualModelTarget } from '@mtsrc/ai-gateway-spec';

export type TargetProfile = {
  modelSlug: string;
  contextTokens: number | null;
  inputModalities: string[];
  supportsTools: boolean;
};

export type Incompatibility =
  'image_input' | 'audio_input' | 'file_input' | 'context_window' | 'tools';

export let incompatibilityOf = (
  profile: TargetProfile,
  summary: RequestSummary
): Incompatibility | null => {
  let modalities = new Set(profile.inputModalities);

  if (summary.hasImages && !modalities.has('image')) return 'image_input';
  if (summary.hasAudio && !modalities.has('audio')) return 'audio_input';
  if (summary.hasFiles && !modalities.has('file') && !modalities.has('pdf'))
    return 'file_input';
  if (profile.contextTokens && summary.estimatedInputTokens > profile.contextTokens) {
    return 'context_window';
  }
  if (summary.toolCount > 0 && !profile.supportsTools) return 'tools';

  return null;
};

export type SkippedTarget = { model: string; reason: Incompatibility | 'unknown_model' };

export let orderTargets = (d: {
  targets: VirtualModelTarget[];
  profiles: Map<string, TargetProfile>;
  summary: RequestSummary;
  random: () => number;
}) => {
  let skipped: SkippedTarget[] = [];

  let compatible = d.targets.filter(target => {
    let profile = d.profiles.get(target.model);
    let reason: SkippedTarget['reason'] | null = profile
      ? incompatibilityOf(profile, d.summary)
      : 'unknown_model';
    if (reason) skipped.push({ model: target.model, reason });

    return !reason;
  });

  let ordered = weightedOrder(
    compatible.map(target => ({ ...target, weight: target.weight ?? 1 })),
    d.random
  );

  return { ordered, skipped };
};
