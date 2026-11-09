import { badRequestError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({
    captureException: mocks.captureException,
    captureMessage: mocks.captureMessage
  })
}));

import { reportSkillSyncIssue } from './report';

describe('reportSkillSyncIssue', () => {
  beforeEach(() => {
    mocks.captureException.mockReset();
    mocks.captureMessage.mockReset();
  });

  it('groups messages by issue and error code', () => {
    reportSkillSyncIssue({
      issue: 'snapshot_failed',
      errorCode: 'empty_manifest',
      message: 'Refusing to publish an empty manifest.',
      skillDestinationSyncId: 'skds_123'
    });

    expect(mocks.captureMessage).toHaveBeenCalledWith(
      'Skill sync snapshot_failed (empty_manifest): Refusing to publish an empty manifest.',
      expect.objectContaining({
        level: 'error',
        fingerprint: ['skill-sync', 'snapshot_failed', 'empty_manifest'],
        tags: {
          area: 'skill_sync',
          'skill_sync.issue': 'snapshot_failed',
          'skill_sync.error_code': 'empty_manifest'
        },
        extra: expect.objectContaining({ skillDestinationSyncId: 'skds_123' })
      })
    );
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it('captures the original error when there is one', () => {
    let error = new TypeError('boom');

    reportSkillSyncIssue({
      issue: 'content_failed',
      errorCode: 'unexpected',
      level: 'warning',
      message: 'boom',
      error
    });

    expect(mocks.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        level: 'warning',
        fingerprint: ['skill-sync', 'content_failed', 'unexpected']
      })
    );
  });

  it('sends service errors as messages so client-error filters keep them', () => {
    let error = new ServiceError(badRequestError({ message: 'Unknown repository' }));

    reportSkillSyncIssue({
      issue: 'propagation_rejected',
      errorCode: 'bad_request',
      message: 'Unknown repository',
      error
    });

    expect(mocks.captureException).not.toHaveBeenCalled();
    expect(mocks.captureMessage).toHaveBeenCalledWith(
      'Skill sync propagation_rejected (bad_request): Unknown repository',
      expect.objectContaining({
        extra: expect.objectContaining({
          serviceError: expect.objectContaining({ status: 400, code: 'bad_request' })
        })
      })
    );
  });

  it('groups issues without a code together', () => {
    reportSkillSyncIssue({ issue: 'repository_repair_failing', message: 'still failing' });

    expect(mocks.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        fingerprint: ['skill-sync', 'repository_repair_failing', 'unknown']
      })
    );
  });
});
