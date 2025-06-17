import { ServiceError } from '@metorial/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serverDeploymentService } from '../src/services/serverDeployment';

// @ts-ignore
let { db } = await import('@metorial/db');

// Mocks
vi.mock('@metorial/db', () => ({
  db: {
    serverDeployment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    serverDeploymentConfig: {
      create: vi.fn(),
      update: vi.fn()
    },
    server: { findMany: vi.fn() },
    serverVariant: { findMany: vi.fn() },
    serverImplementation: { findMany: vi.fn() },
    session: { findMany: vi.fn() }
  },
  ID: { generateId: vi.fn().mockResolvedValue('generated-id') },
  withTransaction: (fn: any) => fn(db)
}));
vi.mock('@metorial/module-catalog', () => ({
  serverVariantService: {
    getServerVariantById: vi.fn()
  }
}));
vi.mock('@metorial/module-event', () => ({
  ingestEventService: { ingest: vi.fn() }
}));
vi.mock('@metorial/module-secret', () => ({
  secretService: {
    createSecret: vi.fn(),
    deleteSecret: vi.fn(),
    getSecretById: vi.fn()
  }
}));
vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));
vi.mock('@metorial/pagination', () => ({
  Paginator: { create: vi.fn(fn => fn({ prisma: (cb: any) => cb({}) })) }
}));
vi.mock('../src/queues/serverDeploymentDeleted', () => ({
  serverDeploymentDeletedQueue: { add: vi.fn() }
}));
vi.mock('@metorial/service', () => ({
  Service: { create: (_: any, fn: any) => ({ build: () => fn() }) }
}));

const instance = { oid: 'inst-oid' };
const organization = {};
const performedBy = { id: 'actor-id' };
const server = { oid: 'server-oid', id: 'server-id' };
const serverVariant = { oid: 'variant-oid', id: 'variant-id' };
const serverImplementation = {
  oid: 'impl-oid',
  id: 'impl-id',
  status: 'active',
  server,
  serverVariant
};
const config = { oid: 'config-oid', isEphemeral: true, configSecretOid: 'secret-oid' };
const serverDeployment = {
  id: 'deployment-id',
  oid: 'deployment-oid',
  status: 'active',
  config,
  serverImplementation
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('serverDeploymentService', () => {
  describe('getServerDeploymentById', () => {
    it('returns deployment if found', async () => {
      // @ts-ignore
      db.serverDeployment.findFirst.mockResolvedValue(serverDeployment);
      const result = await serverDeploymentService.getServerDeploymentById({
        // @ts-ignore
        instance,
        serverDeploymentId: 'deployment-id'
      });
      expect(result).toBe(serverDeployment);
    });

    it('throws if not found', async () => {
      // @ts-ignore
      db.serverDeployment.findFirst.mockResolvedValue(null);
      await expect(
        serverDeploymentService.getServerDeploymentById({
          // @ts-ignore
          instance,
          serverDeploymentId: 'notfound'
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('getManyServerDeployments', () => {
    it('returns deployments if all found', async () => {
      // @ts-ignore
      db.serverDeployment.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      const result = await serverDeploymentService.getManyServerDeployments({
        // @ts-ignore
        instance,
        serverDeploymentIds: ['a', 'b']
      });
      expect(result).toHaveLength(2);
    });

    it('throws if any not found', async () => {
      // @ts-ignore
      db.serverDeployment.findMany.mockResolvedValue([{ id: 'a' }]);
      await expect(
        serverDeploymentService.getManyServerDeployments({
          // @ts-ignore
          instance,
          serverDeploymentIds: ['a', 'b']
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('createServerDeployment', () => {
    it('throws if serverImplementation is deleted', async () => {
      await expect(
        serverDeploymentService.createServerDeployment({
          // @ts-ignore
          organization,
          // @ts-ignore
          performedBy,
          // @ts-ignore
          instance,
          serverImplementation: {
            // @ts-ignore
            instance: { ...serverImplementation, status: 'deleted' },
            isNewEphemeral: false
          },
          input: { config: {}, name: 'name', description: 'desc', metadata: {} },
          type: 'persistent'
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('updateServerDeployment', () => {
    it('updates deployment metadata', async () => {
      // @ts-ignore
      db.serverDeployment.update.mockResolvedValue({
        id: 'deployment-id'
      });
      const result = await serverDeploymentService.updateServerDeployment({
        // @ts-ignore
        organization,
        // @ts-ignore
        performedBy,
        // @ts-ignore
        instance,
        // @ts-ignore
        serverDeployment: { ...serverDeployment, status: 'active' },
        input: { name: 'new', description: 'desc', metadata: { foo: 2 } }
      });
      expect(result).toEqual({ id: 'deployment-id' });
    });

    it('throws if deployment is not active', async () => {
      await expect(
        serverDeploymentService.updateServerDeployment({
          // @ts-ignore
          organization,
          // @ts-ignore
          performedBy,
          // @ts-ignore
          instance,
          // @ts-ignore
          serverDeployment: { ...serverDeployment, status: 'deleted' },
          input: { name: 'new' }
        })
      ).rejects.toThrow(ServiceError);
    });

    it('throws if config update on persistent config', async () => {
      await expect(
        serverDeploymentService.updateServerDeployment({
          // @ts-ignore
          organization,
          // @ts-ignore
          performedBy,
          // @ts-ignore
          instance,
          serverDeployment: {
            ...serverDeployment,
            // @ts-ignore
            config: { ...config, isEphemeral: false },
            status: 'active'
          },
          input: { config: { foo: 'bar' } }
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('deleteServerDeployment', () => {
    it('marks deployment as deleted', async () => {
      // @ts-ignore
      db.serverDeployment.update.mockResolvedValue({
        id: 'deployment-id'
      });
      const result = await serverDeploymentService.deleteServerDeployment({
        // @ts-ignore
        organization,
        // @ts-ignore
        performedBy,
        // @ts-ignore
        instance,
        // @ts-ignore
        serverDeployment: { ...serverDeployment, status: 'active' }
      });
      expect(result).toEqual({ id: 'deployment-id' });
    });

    it('throws if deployment is not active', async () => {
      await expect(
        serverDeploymentService.deleteServerDeployment({
          // @ts-ignore
          organization,
          // @ts-ignore
          performedBy,
          // @ts-ignore
          instance,
          // @ts-ignore
          serverDeployment: { ...serverDeployment, status: 'deleted' }
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('listServerDeployments', () => {
    it('calls paginator with correct filters', async () => {
      // @ts-ignore
      db.server.findMany.mockResolvedValue([server]);
      // @ts-ignore
      db.serverVariant.findMany.mockResolvedValue([serverVariant]);
      // @ts-ignore
      db.serverImplementation.findMany.mockResolvedValue([serverImplementation]);
      // @ts-ignore
      db.session.findMany.mockResolvedValue([{ oid: 'sess-oid' }]);
      // @ts-ignore
      db.serverDeployment.findMany.mockResolvedValue([{ id: 'deployment-id' }]);

      const paginator = await serverDeploymentService.listServerDeployments({
        serverIds: ['server-id'],
        serverVariantIds: ['variant-id'],
        serverImplementationIds: ['impl-id'],
        sessionIds: ['sess-id'],
        // @ts-ignore
        instance,
        status: ['active']
      });
      expect(paginator).toEqual([{ id: 'deployment-id' }]);
    });
  });
});
