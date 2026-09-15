import { describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/error', () => ({
  ServiceError: class ServiceError extends Error {},
  badRequestError: ({ message }: { message: string }) => new Error(message),
  goneError: ({ message }: { message: string }) => new Error(message),
  internalServerError: ({ message }: { message: string }) => new Error(message),
  notFoundError: (_object: string, id?: string) => new Error(id ?? 'not found'),
  preconditionFailedError: ({ message }: { message: string }) => new Error(message)
}));
vi.mock('@lowerdeck/lock', () => ({ createLock: vi.fn(() => ({})) }));
vi.mock('@lowerdeck/sentry', () => ({
  getSentry: vi.fn(() => ({ captureException: vi.fn() }))
}));
vi.mock('@metorial-subspace/conduit', () => ({
  ConduitSendError: class ConduitSendError extends Error {}
}));
vi.mock('@metorial-subspace/db', () => ({
  db: {},
  getId: vi.fn(),
  ID: {},
  withTransaction: vi.fn()
}));
vi.mock('@metorial-subspace/module-agent', () => ({}));
vi.mock('@metorial-subspace/module-enclave', () => ({}));
vi.mock('@metorial-subspace/module-provider-internal', () => ({}));
vi.mock('@metorial-subspace/module-session', () => ({
  applySessionProviderNameTemplate: vi.fn(),
  parseNameFromSessionProviderTemplates: vi.fn(() => null),
  sessionProviderNameTemplateService: {}
}));
vi.mock('@metorial-subspace/module-session/src/services/ephemeralManagedSession', () => ({
  ephemeralManagedSessionService: {}
}));
vi.mock('../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost' } }
}));
vi.mock('../lib/conduit', () => ({
  conduit: { createSender: vi.fn(() => ({})) }
}));
vi.mock('../lib/nats', () => ({ broadcastNats: vi.fn() }));
vi.mock('../audit/recordMessage', () => ({ recordConnectionAuditEvent: vi.fn() }));
vi.mock('../shared/completeMessage', () => ({ completeMessage: vi.fn() }));
vi.mock('../shared/createError', () => ({ createError: vi.fn() }));
vi.mock('../shared/createMessage', () => ({ createMessage: vi.fn() }));
vi.mock('../shared/createWarning', () => ({ createWarning: vi.fn() }));
vi.mock('../shared/upsertParticipant', () => ({ upsertParticipant: vi.fn() }));
vi.mock('./connectionSpecification', () => ({
  isConnectionScopedProviderVersion: vi.fn(),
  resolveConnectionScopedSpecification: vi.fn()
}));
vi.mock('./toolSpecification', () => ({
  resolveProviderToolListingSpecificationOid: vi.fn()
}));

import { SenderManager } from './manager';

let createManager = (isInternal: boolean) =>
  new (SenderManager as any)(
    { isInternal },
    undefined,
    {},
    {},
    'tool_call',
    undefined,
    undefined
  ) as SenderManager;

describe('SenderManager tool resolution', () => {
  it('resolves canonical adapter keys for internal sessions', async () => {
    let manager = createManager(true) as any;
    let provider = { id: 'spr_1', nameTemplate: 'slack_$' };
    let resolved = { provider, tool: { key: 'metorial_chat$workspace.list' } };

    manager.listProviders = vi.fn(async () => [provider]);
    manager.getLegacyToolMatch = vi.fn();
    manager.getProviderToolByResolvedName = vi.fn(async () => resolved);

    await expect(
      manager.getToolById({ toolId: 'metorial_chat$workspace.list' })
    ).resolves.toBe(resolved);
    expect(manager.getProviderToolByResolvedName).toHaveBeenCalledWith({
      provider,
      originalToolName: 'metorial_chat$workspace.list',
      finalToolName: 'metorial_chat$workspace.list'
    });
    expect(manager.getLegacyToolMatch).not.toHaveBeenCalled();
  });

  it('does not resolve canonical adapter keys for ordinary sessions', async () => {
    let manager = createManager(false) as any;
    let provider = { id: 'spr_1', nameTemplate: 'slack_$' };

    manager.listProviders = vi.fn(async () => [provider]);
    manager.getLegacyToolMatch = vi.fn(async () => null);
    manager.getProviderToolByResolvedName = vi.fn();

    await expect(
      manager.getToolById({ toolId: 'metorial_chat$workspace.list' })
    ).rejects.toThrow('Invalid tool ID format');
    expect(manager.getLegacyToolMatch).toHaveBeenCalled();
    expect(manager.getProviderToolByResolvedName).not.toHaveBeenCalled();
  });
});
