import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { createHmac } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { scmAppWebhookController } from './scmAppWebhook';

let mocks = vi.hoisted(() => ({ find: vi.fn(), created: vi.fn(), assert: vi.fn() }));

vi.mock('../db', () => ({ db: { scmBackend: { findUnique: mocks.find } } }));
vi.mock('../services/scmAuth', () => ({
  scmAuthService: { handleGitHubAppInstallationCreated: mocks.created }
}));
vi.mock('../env', () => ({ delegateSecretsToNebula: false }));
vi.mock('../lib/scmPolicy', () => ({ assertScmBackendAllowed: mocks.assert }));

let backend = { id: 'backend-a', type: 'github', appWebhookSecret: 'secret-a' };

let request = (secret: string) => {
  let payload = JSON.stringify({ action: 'created', installation: { id: 123 } });
  return new Request('https://origin.example/origin/webhook-ingest/github-app/backend-a', {
    method: 'POST',
    body: payload,
    headers: {
      'X-GitHub-Event': 'installation',
      'X-Hub-Signature-256': `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`
    }
  });
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.find.mockResolvedValue(backend);
});

it('verifies with the selected backend secret and scopes dispatch to that backend', async () => {
  let response = await scmAppWebhookController.fetch(request('secret-a'));
  expect(response.status).toBe(200);
  expect(mocks.assert).toHaveBeenCalledWith(backend);
  expect(mocks.created).toHaveBeenCalledWith({ backend, installationId: '123' });
});

it('rejects a signature from another configured application', async () => {
  expect((await scmAppWebhookController.fetch(request('secret-b'))).status).toBe(401);
  expect(mocks.created).not.toHaveBeenCalled();
});

it('does not dispatch a backend blocked by policy', async () => {
  mocks.assert.mockImplementation(() => {
    throw new ServiceError(forbiddenError({ message: 'Policy denied' }));
  });
  expect((await scmAppWebhookController.fetch(request('secret-a'))).status).toBe(403);
  expect(mocks.created).not.toHaveBeenCalled();
});
