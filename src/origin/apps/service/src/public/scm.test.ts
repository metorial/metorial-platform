import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  env: { gh: { SCM_GITHUB_APP_WEBHOOK_SECRET: undefined as string | undefined } },
  auth: {
    handleInstallation: vi.fn(),
    handleGitLabOAuthCallback: vi.fn(),
    handleBitbucketOAuthCallback: vi.fn(),
    handleGitHubAppInstallationCreated: vi.fn()
  },
  repo: {
    receiveGitHubWebhookEvent: vi.fn(),
    receiveGitLabWebhookEvent: vi.fn(),
    receiveBitbucketWebhookEvent: vi.fn()
  }
}));

vi.mock('../env', () => ({ env: mocks.env }));
vi.mock('../services', () => ({
  scmAuthService: mocks.auth,
  scmRepoService: mocks.repo
}));
vi.mock('./scmBackendSetup', async () => {
  let { createHono } = await import('@lowerdeck/hono');
  return { scmBackendSetupPublicController: createHono() };
});
vi.mock('./scmInstallationSession', async () => {
  let { createHono } = await import('@lowerdeck/hono');
  return { scmInstallationSessionPublicController: createHono() };
});

import { scmController } from './scm';

let webhookRequest = (payload: string, signature: string) =>
  new Request('https://origin.example.com/origin/webhook-ingest/github-app', {
    method: 'POST',
    headers: {
      'X-GitHub-Event': 'installation',
      'X-GitHub-Delivery': 'delivery-1',
      'X-Hub-Signature-256': signature
    },
    body: payload
  });

describe('GitHub App webhook', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.env.gh.SCM_GITHUB_APP_WEBHOOK_SECRET = undefined;
  });

  it('is disabled when no webhook secret is configured', async () => {
    let response = await scmController.request(webhookRequest('{}', 'sha256=invalid'));
    expect(response.status).toBe(404);
  });

  it('rejects an invalid signature', async () => {
    mocks.env.gh.SCM_GITHUB_APP_WEBHOOK_SECRET = 'secret';
    let response = await scmController.request(webhookRequest('{}', 'sha256=invalid'));
    expect(response.status).toBe(401);
    expect(mocks.auth.handleGitHubAppInstallationCreated).not.toHaveBeenCalled();
  });

  it('processes a signed installation.created event', async () => {
    mocks.env.gh.SCM_GITHUB_APP_WEBHOOK_SECRET = 'secret';
    let payload = JSON.stringify({ action: 'created', installation: { id: 123 } });
    let signature = `sha256=${crypto.createHmac('sha256', 'secret').update(payload).digest('hex')}`;

    let response = await scmController.request(webhookRequest(payload, signature));

    expect(response.status).toBe(200);
    expect(mocks.auth.handleGitHubAppInstallationCreated).toHaveBeenCalledWith({
      installationId: '123'
    });
  });
});

describe('GitHub callback routing', () => {
  beforeEach(() => vi.resetAllMocks());

  it('accepts an approval request without an installation ID', async () => {
    mocks.auth.handleInstallation.mockResolvedValue({
      kind: 'pending_approval',
      sessionId: 'osis_123',
      matched: true
    });
    let response = await scmController.request(
      'https://origin.example.com/origin/oauth/github/callback?setup_action=request&state=state&code=code'
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/origin/scm/installation-session/osis_123');
    expect(mocks.auth.handleInstallation).toHaveBeenCalledWith({
      provider: 'github',
      setupAction: 'request',
      installationId: undefined,
      state: 'state',
      code: 'code'
    });
  });

  it('renders a stable success page for a state-less install callback', async () => {
    mocks.auth.handleInstallation.mockResolvedValue({ kind: 'succeeded', matched: false });
    let response = await scmController.request(
      'https://origin.example.com/origin/oauth/github/callback?setup_action=install&installation_id=123'
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('GitHub connected');
  });

  it('rejects unknown setup actions during query validation', async () => {
    let response = await scmController.request(
      'https://origin.example.com/origin/oauth/github/callback?setup_action=unknown'
    );
    expect(response.status).toBe(400);
    expect(mocks.auth.handleInstallation).not.toHaveBeenCalled();
  });
});
