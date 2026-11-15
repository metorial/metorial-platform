import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  add: vi.fn(),
  env: { generation: { SECURITY_REVIEW_AUTO_GENERATION: undefined as string | undefined } }
}));

vi.mock('@lowerdeck/queue', () => ({ createQueue: () => ({ add: mocks.add }) }));
vi.mock('./env', () => ({ env: { service: { REDIS_URL: 'redis://test' }, ...mocks.env } }));

let { requestSecurityReview, securityReviewRequestId } = await import('./index');

describe('requestSecurityReview', () => {
  beforeEach(() => {
    mocks.add.mockReset();
    mocks.add.mockResolvedValue(undefined);
    mocks.env.generation.SECURITY_REVIEW_AUTO_GENERATION = undefined;
  });

  it('does nothing while automatic generation is off', async () => {
    await requestSecurityReview({ subject: 'specChange', id: 'chg_1' });

    expect(mocks.add).not.toHaveBeenCalled();
  });

  it('queues with a deterministic id when automatic generation is on', async () => {
    mocks.env.generation.SECURITY_REVIEW_AUTO_GENERATION = 'true';

    await requestSecurityReview({ subject: 'specChange', id: 'chg_1' });
    await requestSecurityReview({ subject: 'specChange', id: 'chg_1' });

    expect(mocks.add).toHaveBeenCalledTimes(2);
    expect(mocks.add.mock.calls.map(call => call[1])).toEqual([
      { id: 'change:chg_1' },
      { id: 'change:chg_1' }
    ]);
  });

  it.each([undefined, 'false'])(
    'queues every skill trigger when automatic generation is %s',
    async value => {
      mocks.env.generation.SECURITY_REVIEW_AUTO_GENERATION = value;

      for (let trigger of [
        'new_version',
        'skill_import',
        'page_open',
        'reassess',
        'admin'
      ] as const) {
        await requestSecurityReview({ subject: 'skill', id: 'skill_1', trigger });
      }

      expect(mocks.add).toHaveBeenCalledTimes(5);
    }
  );

  it.each(['page_open', 'reassess', 'admin'] as const)(
    'allows an explicit provider %s request with automatic generation off',
    async trigger => {
      await requestSecurityReview({ subject: 'providerVersion', id: 'pv_1', trigger });

      expect(mocks.add).toHaveBeenCalledOnce();
    }
  );

  it('keeps speculative provider work disabled', async () => {
    await requestSecurityReview({ subject: 'customProviderVersion', id: 'cpv_1' });
    await requestSecurityReview({ subject: 'provider', id: 'pro_1' });
    await requestSecurityReview({
      subject: 'providerVersion',
      id: 'pv_1',
      trigger: 'new_version'
    });

    expect(mocks.add).not.toHaveBeenCalled();
  });

  it('never fails the caller when queueing fails', async () => {
    mocks.env.generation.SECURITY_REVIEW_AUTO_GENERATION = 'true';
    mocks.add.mockRejectedValue(new Error('redis down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      requestSecurityReview({ subject: 'provider', id: 'pro_1' })
    ).resolves.toBeUndefined();
  });

  it('derives distinct ids per subject and trigger', () => {
    expect(securityReviewRequestId({ subject: 'customProviderVersion', id: 'a' })).toBe(
      'cpv:a'
    );
    expect(securityReviewRequestId({ subject: 'provider', id: 'a' })).toBe('provider:a');
    expect(
      securityReviewRequestId({
        subject: 'providerVersion',
        id: 'a',
        trigger: 'census_changed'
      })
    ).toBe('pv:a:census_changed');
  });
});
