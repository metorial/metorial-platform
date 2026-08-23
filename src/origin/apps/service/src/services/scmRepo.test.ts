import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGitLabClientWithInstallation } from '../lib/gitlab';

vi.mock('../db', () => ({ db: {} }));
vi.mock('../lib/githubApp', () => ({ createGitHubInstallationClient: vi.fn() }));
vi.mock('../lib/gitlab', () => ({
  createGitLabClientWithInstallation: vi.fn()
}));
vi.mock('../queues/scm/createRepoWebhook', () => ({
  createRepoWebhookQueue: { add: vi.fn() }
}));
vi.mock('../queues/scm/handleRepoPush', () => ({
  createHandleRepoPushQueue: { add: vi.fn() }
}));

import {
  getGitLabCreateProjectInput,
  normalizeGitLabDefaultBranch,
  scmRepoService
} from './scmRepo';

let createGitLabClient = vi.mocked(createGitLabClientWithInstallation);

describe('SCM repository GitLab authentication', () => {
  beforeEach(() => {
    createGitLabClient.mockReset();
  });

  it('uses the installation-aware client when listing GitLab groups', async () => {
    let gitlab = {
      Groups: {
        all: vi.fn().mockResolvedValue([
          {
            id: 8,
            path: 'metorial',
            full_path: 'metorial',
            avatar_url: 'https://gitlab.com/uploads/group.png'
          }
        ])
      },
      Users: {
        showCurrentUser: vi.fn().mockResolvedValue({
          id: 6,
          namespaceId: 7,
          username: 'tobias',
          avatar_url: 'https://gitlab.com/uploads/user.png'
        })
      },
      Namespaces: {
        all: vi.fn().mockResolvedValue([])
      }
    };
    createGitLabClient.mockResolvedValue(gitlab as any);
    let installation = {
      provider: 'gitlab',
      backend: { webUrl: 'https://gitlab.com' }
    } as any;

    let accounts = await scmRepoService.listAccountPreviews({ installation });

    expect(createGitLabClient).toHaveBeenCalledWith(installation);
    expect(gitlab.Groups.all).toHaveBeenCalledWith({
      minAccessLevel: 30,
      perPage: 100
    });
    expect(accounts).toEqual([
      expect.objectContaining({ imageUrl: 'https://gitlab.com/uploads/user.png' }),
      expect.objectContaining({ imageUrl: 'https://gitlab.com/uploads/group.png' })
    ]);
  });

  it.each([
    [null, 'main'],
    [undefined, 'main'],
    ['', 'main'],
    ['null', 'main'],
    [' undefined ', 'main'],
    [' master ', 'master']
  ])('normalizes GitLab default branch %j to %s', (value, expected) => {
    expect(normalizeGitLabDefaultBranch(value)).toBe(expected);
  });

  it('initializes GitLab projects with an explicit default branch', async () => {
    expect(
      getGitLabCreateProjectInput({
      name: 'new-project',
      description: 'Project description',
        isPrivate: true,
        namespaceId: 8
      })
    ).toEqual({
      name: 'new-project',
      description: 'Project description',
      visibility: 'private',
      namespaceId: 8,
      initializeWithReadme: true,
      defaultBranch: 'main'
    });
  });
});
