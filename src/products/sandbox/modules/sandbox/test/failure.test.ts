import { describe, expect, it } from 'vitest';
import {
  mapSandboxBuildFailure,
  mapSandboxFailure,
  mapSandboxFailureCode
} from '../src/lib/failure';

describe('mapSandboxFailure', () => {
  it('returns null without a failure', () => {
    expect(mapSandboxFailure(null)).toBeNull();
    expect(mapSandboxFailure(undefined)).toBeNull();
  });

  it.each([
    ['disks_unavailable', 'disk_unavailable'],
    ['mount_failed', 'disk_unavailable'],
    ['rootfs_failed', 'disk_unavailable'],
    ['image_not_ready', 'image_unavailable'],
    ['machine_images_unavailable', 'image_unavailable'],
    ['task_deadline', 'timeout'],
    ['resume_stalled', 'timeout'],
    ['start_interrupted', 'start_failed'],
    ['agent_error', 'start_failed'],
    ['builder_lost', 'provision_failed'],
    ['cancelled', 'cancelled'],
    ['resize_failed', 'resize_failed'],
    ['some_unknown_code', 'internal_error']
  ])('maps %s to %s', (code, expected) => {
    expect(mapSandboxFailureCode(code)).toBe(expected);
  });

  it('never leaks the original message or code', () => {
    let result = mapSandboxFailure({
      code: 'disk_fenced',
      message: 'host i-0abc fenced epoch 4'
    });

    expect(result).toEqual({
      code: 'disk_unavailable',
      message: 'A disk required by the sandbox is unavailable.'
    });
  });
});

describe('mapSandboxBuildFailure', () => {
  it('keeps public build codes and replaces the message', () => {
    expect(
      mapSandboxBuildFailure({ code: 'replication_failed', message: 'host 10.0.0.4 refused' })
    ).toEqual({
      code: 'replication_failed',
      message: 'The image could not be replicated to every region.'
    });
  });

  it('maps unknown codes', () => {
    expect(mapSandboxBuildFailure({ code: 'build_timeout', message: 'x' })?.code).toBe(
      'timeout'
    );
    expect(mapSandboxBuildFailure({ code: 'weird', message: 'x' })?.code).toBe(
      'internal_error'
    );
    expect(mapSandboxBuildFailure(null)).toBeNull();
  });
});
