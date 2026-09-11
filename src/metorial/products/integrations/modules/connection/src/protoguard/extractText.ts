import type { SessionMessage } from '@metorial-subspace/db';
import { MAX_SCAN_TARGET_LENGTH, MAX_SCAN_TARGETS } from './config';
import type { ProtoGuardScanTarget } from './types';

let isObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

let truncate = (value: string) =>
  value.length > MAX_SCAN_TARGET_LENGTH ? value.slice(0, MAX_SCAN_TARGET_LENGTH) : value;

let addTarget = (targets: ProtoGuardScanTarget[], path: string, content: string) => {
  if (targets.length >= MAX_SCAN_TARGETS) return;
  if (!content.trim()) return;

  targets.push({
    path,
    content: truncate(content)
  });
};

let collectText = (targets: ProtoGuardScanTarget[], path: string, value: unknown) => {
  if (targets.length >= MAX_SCAN_TARGETS) return;

  if (typeof value === 'string') {
    addTarget(targets, path, value);
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectText(targets, `${path}[${i}]`, value[i]);
    }
    return;
  }

  if (!isObject(value)) return;

  for (let [key, child] of Object.entries(value)) {
    collectText(targets, `${path}.${key}`, child);
  }
};

let stringifyPayload = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return null;
  }
};

export let extractProtoGuardScanTargets = (
  message: SessionMessage
): ProtoGuardScanTarget[] => {
  let targets: ProtoGuardScanTarget[] = [];

  if (message.input) {
    collectText(targets, 'input', message.input);
    let serializedInput = stringifyPayload(message.input);
    if (serializedInput) addTarget(targets, 'input.$json', serializedInput);
  }

  if (message.output) {
    collectText(targets, 'output', message.output);
    let serializedOutput = stringifyPayload(message.output);
    if (serializedOutput) addTarget(targets, 'output.$json', serializedOutput);
  }

  return targets;
};
