import { describe, expect, it, vi } from 'vitest';

vi.mock('../env', () => ({
  env: { service: { ORIGIN_SERVICE_PUBLIC_URL: 'https://origin.example.com' } }
}));
vi.mock('./bitbucket', () => ({ createBitbucketClientWithInstallation: vi.fn() }));
vi.mock('./githubApp', () => ({ createGitHubInstallationClient: vi.fn() }));
vi.mock('./gitlab', () => ({ createGitLabClientWithInstallation: vi.fn() }));

import {
  equalRepositoryWebhookEvents,
  getDesiredRepositoryWebhookEvents,
  getNativeRepositoryWebhookEvents,
  getRepositoryWebhookCallbackUrl,
  normalizeRepositoryWebhookEvents
} from './scmRepositoryWebhook';

let repo = (
  provider: 'github' | 'gitlab' | 'bitbucket',
  backendType = provider
) =>
  ({
    provider,
    installation: { backend: { type: backendType } }
  }) as any;

describe('SCM repository webhook event mappings', () => {
  it('maps the canonical event capabilities to GitHub events', () => {
    let github = repo('github');
    expect(getDesiredRepositoryWebhookEvents(github)).toEqual([
      'push',
      'pull_request',
      'pull_request_review',
      'ci_status',
      'ci_check'
    ]);
    expect(getNativeRepositoryWebhookEvents(github)).toEqual([
      'push',
      'pull_request',
      'pull_request_review',
      'status',
      'check_run',
      'check_suite'
    ]);
  });

  it('uses only capabilities supported by GitLab', () => {
    let gitlab = repo('gitlab');
    expect(getDesiredRepositoryWebhookEvents(gitlab)).toEqual([
      'push',
      'pull_request',
      'ci_status'
    ]);
    expect(getNativeRepositoryWebhookEvents(gitlab)).toEqual([
      'push_events',
      'merge_requests_events',
      'pipeline_events'
    ]);
  });

  it('separates Bitbucket Cloud and Data Center event vocabularies', () => {
    expect(getNativeRepositoryWebhookEvents(repo('bitbucket'))).toContain(
      'repo:commit_status_updated'
    );
    expect(
      getNativeRepositoryWebhookEvents(repo('bitbucket', 'bitbucket_data_center'))
    ).toEqual([
      'repo:refs_changed',
      'pr:opened',
      'pr:modified',
      'pr:merged',
      'pr:declined',
      'pr:reviewer:approved'
    ]);
  });

  it('requires every native event that implements an abstract capability', () => {
    let github = repo('github');
    expect(
      normalizeRepositoryWebhookEvents(github, [
        'push',
        'pull_request',
        'pull_request_review',
        'status',
        'check_run'
      ])
    ).toEqual(['push', 'pull_request', 'pull_request_review', 'ci_status']);
  });

  it('compares normalized sets without depending on order or duplicates', () => {
    expect(equalRepositoryWebhookEvents(['push', 'ci_status'], ['ci_status', 'push'])).toBe(
      true
    );
    expect(equalRepositoryWebhookEvents(['push', 'push'], ['push'])).toBe(true);
    expect(equalRepositoryWebhookEvents(['push'], ['push', 'ci_status'])).toBe(false);
  });

  it('builds a provider-specific stable callback URL', () => {
    expect(getRepositoryWebhookCallbackUrl('gitlab', 'osw_test')).toBe(
      'https://origin.example.com/origin/webhook-ingest/gl/osw_test'
    );
  });
});
