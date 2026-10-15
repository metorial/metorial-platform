import { describe, expect, it } from 'vitest';
import {
  getSandboxBuildStatus,
  getSandboxDiskStatus,
  getSandboxImageStatus,
  getSandboxMachineStatus,
  getSandboxMountStatus,
  getSandboxOperationKindLabel,
  getSandboxOperationTriggerLabel,
  getSandboxResizeStatus,
  isSandboxBuildActive,
  isSandboxMachineTransitional,
  isSandboxResizeActive
} from './statusBadges';

describe('machine status', () => {
  it('maps every status to a tone', () => {
    expect(getSandboxMachineStatus('running')).toEqual({
      label: 'Running',
      tone: 'green',
      isTransitional: false
    });

    for (let status of [
      'starting',
      'resuming',
      'restarting',
      'upgrading',
      'pausing',
      'hibernating',
      'terminating'
    ]) {
      expect(getSandboxMachineStatus(status)).toMatchObject({
        tone: 'orange',
        isTransitional: true
      });
      expect(isSandboxMachineTransitional(status)).toBe(true);
    }

    for (let status of ['paused', 'hibernated', 'terminated']) {
      expect(getSandboxMachineStatus(status).tone).toBe('gray');
    }

    expect(getSandboxMachineStatus('failed')).toMatchObject({ label: 'Failed', tone: 'red' });
    expect(isSandboxMachineTransitional('running')).toBe(false);
  });

  it('falls back to gray Title Case for unknown values', () => {
    expect(getSandboxMachineStatus('some_new_state')).toEqual({
      label: 'Some New State',
      tone: 'gray',
      isTransitional: false
    });
  });
});

describe('build status', () => {
  it('shows preparing and queued as Queued', () => {
    expect(getSandboxBuildStatus('preparing')).toMatchObject({
      label: 'Queued',
      tone: 'gray'
    });
    expect(getSandboxBuildStatus('queued')).toMatchObject({ label: 'Queued', tone: 'gray' });
  });

  it('maps the rest', () => {
    expect(getSandboxBuildStatus('succeeded').tone).toBe('blue');
    expect(getSandboxBuildStatus('building').isTransitional).toBe(true);
    expect(getSandboxBuildStatus('replicating').tone).toBe('orange');
    expect(getSandboxBuildStatus('cancelled').tone).toBe('gray');
    expect(getSandboxBuildStatus('timed_out')).toMatchObject({
      label: 'Timed Out',
      tone: 'red'
    });
  });

  it('treats queued builds as active for polling', () => {
    expect(isSandboxBuildActive('queued')).toBe(true);
    expect(isSandboxBuildActive('succeeded')).toBe(false);
    expect(isSandboxBuildActive(null)).toBe(false);
  });
});

describe('disk, resize and mount status', () => {
  it('shows Resizing while a resize is active', () => {
    expect(getSandboxDiskStatus('active', { activeResize: { id: 'r' } })).toEqual({
      label: 'Resizing',
      tone: 'orange',
      isTransitional: true
    });
    expect(getSandboxDiskStatus('active', { activeResize: null }).tone).toBe('green');
    expect(getSandboxDiskStatus('cloning').tone).toBe('orange');
    expect(getSandboxDiskStatus('sealed').tone).toBe('gray');
  });

  it('maps resize statuses', () => {
    expect(getSandboxResizeStatus('complete').tone).toBe('green');
    expect(getSandboxResizeStatus('draining').isTransitional).toBe(true);
    expect(getSandboxResizeStatus('failed').tone).toBe('red');
    expect(isSandboxResizeActive('verifying')).toBe(true);
    expect(isSandboxResizeActive('complete')).toBe(false);
  });

  it('maps mount states', () => {
    expect(getSandboxMountStatus('mounted').tone).toBe('green');
    expect(getSandboxMountStatus('waiting').tone).toBe('orange');
    expect(getSandboxMountStatus('idle').tone).toBe('gray');
    expect(getSandboxMountStatus('failed').tone).toBe('red');
  });
});

describe('image status', () => {
  it('hides the badge for active images', () => {
    expect(getSandboxImageStatus('active')).toBeNull();
    expect(getSandboxImageStatus('active', { latestBuildStatus: 'failed' })).toBeNull();
  });

  it('shows Building while the latest build runs', () => {
    expect(getSandboxImageStatus('active', { latestBuildStatus: 'building' })).toMatchObject({
      label: 'Building',
      tone: 'orange'
    });
    expect(getSandboxImageStatus('pending', { latestBuildStatus: 'queued' })?.label).toBe(
      'Building'
    );
  });

  it('distinguishes No Version from Build Failed', () => {
    expect(getSandboxImageStatus('pending')).toMatchObject({
      label: 'No Version',
      tone: 'gray'
    });
    expect(getSandboxImageStatus('pending', { latestBuildStatus: 'failed' })).toMatchObject({
      label: 'Build Failed',
      tone: 'red'
    });
  });
});

describe('operation labels', () => {
  it('labels kinds and triggers', () => {
    expect(getSandboxOperationKindLabel('hibernate')).toBe('Hibernating');
    expect(getSandboxOperationTriggerLabel('idle_policy')).toBe('Idle Policy');
    expect(getSandboxOperationTriggerLabel('api')).toBe('API');
  });
});
