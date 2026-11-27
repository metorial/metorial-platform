import { RiErrorWarningLine } from '@remixicon/react';
import { describe, expect, it } from 'vitest';
import {
  getSandboxMachineEventCopy,
  getSandboxMachineEventSourceLabel,
  sandboxMachineEventGroups,
  sandboxMachineEventTypes
} from './eventCopy';

describe('sandbox machine event copy', () => {
  it('covers all 64 event types', () => {
    expect(sandboxMachineEventTypes).toHaveLength(64);
    expect(new Set(sandboxMachineEventTypes).size).toBe(64);

    for (let type of sandboxMachineEventTypes) {
      let copy = getSandboxMachineEventCopy(type);
      expect(copy.sentence.length).toBeGreaterThan(0);
      expect(copy.icon).toBeTruthy();
    }
  });

  it('flags error events', () => {
    for (let type of [
      'failed',
      'machine_failed',
      'guest_error',
      'platform_error',
      'rootfs_failed',
      'runtime_setup_failed',
      'runtime_failed'
    ]) {
      let copy = getSandboxMachineEventCopy(type);
      expect(copy.isError).toBe(true);
      expect(copy.icon).toBe(RiErrorWarningLine);
    }

    expect(getSandboxMachineEventCopy('machine_running').isError).toBe(false);
  });

  it('falls back to Title Case for unknown types', () => {
    expect(getSandboxMachineEventCopy('brand_new_thing')).toMatchObject({
      sentence: 'Brand New Thing',
      isError: false
    });
    expect(getSandboxMachineEventCopy('mystery_failed').isError).toBe(true);
  });

  it('puts every type in exactly one group', () => {
    let grouped = sandboxMachineEventGroups.flatMap(group => group.types);

    expect(sandboxMachineEventGroups.map(group => group.label)).toEqual([
      'Lifecycle',
      'Runtime',
      'Disks',
      'Errors'
    ]);
    expect(grouped).toHaveLength(64);
    expect(new Set(grouped).size).toBe(64);
  });

  it('labels sources', () => {
    expect(getSandboxMachineEventSourceLabel('api')).toBe('API');
    expect(getSandboxMachineEventSourceLabel('guest')).toBe('Machine');
    expect(getSandboxMachineEventSourceLabel('other_thing')).toBe('Other Thing');
  });
});
