import type { SkillMarketplaceRepository, SkillSync } from '@metorial/state';
import { describe, expect, it } from 'vitest';
import { getSyncStatusMessage } from './repositorySyncMessage';

let resumesAt = new Date(Date.now() + 60 * 60 * 1000);

let repository = (repoId: string) =>
  ({
    repoId,
    repository: {
      name: repoId,
      url: `https://github.com/acme/${repoId}`,
      provider: 'github'
    }
  }) as SkillMarketplaceRepository;

let propagation = (repoId: string, p: Record<string, unknown> = {}) => ({
  repoId,
  status: 'processing',
  waitingUntil: null,
  waitingReason: null,
  endReason: null,
  ...p
});

let processingSync = (propagations: ReturnType<typeof propagation>[]) =>
  ({
    status: 'processing',
    createdAt: new Date(),
    startedAt: new Date(),
    completedAt: null,
    repositoryPropagations: propagations
  }) as unknown as SkillSync;

let repositories = [repository('skills'), repository('more-skills'), repository('docs')];

describe('getSyncStatusMessage while a sync is processing', () => {
  it('only reports the waiting repositories as paused', () => {
    let message = getSyncStatusMessage(
      processingSync([
        propagation('skills'),
        propagation('more-skills', { waitingUntil: resumesAt, waitingReason: 'rate_limited' }),
        propagation('docs')
      ]),
      repositories
    );

    expect(message).toMatch(
      /^The skill repositories acme\/skills and acme\/docs are syncing now\. acme\/more-skills is paused\. Waiting for GitHub rate limit, resumes at .+\.$/
    );
  });

  it('reports every repository as paused when all of them wait', () => {
    let message = getSyncStatusMessage(
      processingSync([
        propagation('skills', { waitingUntil: resumesAt, waitingReason: 'rate_limited' }),
        propagation('docs', { waitingUntil: resumesAt, waitingReason: 'rate_limited' })
      ]),
      repositories
    );

    expect(message).toMatch(
      /^The skill repositories acme\/skills and acme\/docs are paused\. Waiting for GitHub rate limit/
    );
  });

  it('ignores waits on propagations that already ended', () => {
    expect(
      getSyncStatusMessage(
        processingSync([
          propagation('skills'),
          propagation('docs', {
            waitingUntil: resumesAt,
            status: 'completed'
          }),
          propagation('more-skills', { waitingUntil: resumesAt, endReason: 'superseded' })
        ]),
        repositories
      )
    ).toBe(
      'The skill repositories acme/skills, acme/more-skills, and acme/docs are syncing now.'
    );
  });

  it('says a single repository is syncing when nothing waits', () => {
    expect(getSyncStatusMessage(processingSync([propagation('skills')]), repositories)).toBe(
      'The skill repository acme/skills is syncing now.'
    );
  });
});
