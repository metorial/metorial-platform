import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Prisma } from '@mtsrc/ai-gateway-db';
import { routableModelStatuses } from '../lib/status';

export let modelInclude = { lab: true } as const;

export let offeringInclude = { provider: true, model: { include: modelInclude } } as const;

class CatalogServiceImpl {
  async listLabs() {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => await db.lab.findMany({ ...opts, where: { removedAt: null } }))
    );
  }

  async getLab(d: { labId: string }) {
    let lab = await db.lab.findFirst({
      where: { OR: [{ id: d.labId }, { slug: d.labId }], removedAt: null }
    });
    if (!lab) throw new ServiceError(notFoundError('lab'));

    return lab;
  }

  async listProviders() {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => await db.provider.findMany({ ...opts, where: { removedAt: null } }))
    );
  }

  async getProvider(d: { providerId: string }) {
    let provider = await db.provider.findFirst({
      where: { OR: [{ id: d.providerId }, { slug: d.providerId }], removedAt: null }
    });
    if (!provider) throw new ServiceError(notFoundError('provider'));

    return provider;
  }

  async listModels(d: { labSlug?: string; kind?: string; search?: string } = {}) {
    let where: Prisma.ModelWhereInput = {
      removedAt: null,
      status: { in: routableModelStatuses },
      kind: d.kind,
      lab: d.labSlug ? { slug: d.labSlug } : undefined,
      OR: d.search
        ? [
            { slug: { contains: d.search, mode: 'insensitive' } },
            { name: { contains: d.search, mode: 'insensitive' } }
          ]
        : undefined
    };

    return Paginator.create(({ prisma }) =>
      prisma(async opts => await db.model.findMany({ ...opts, where, include: modelInclude }))
    );
  }

  async getModel(d: { modelId: string }) {
    let model = await db.model.findFirst({
      where: { OR: [{ id: d.modelId }, { slug: d.modelId }], removedAt: null },
      include: modelInclude
    });
    if (!model) throw new ServiceError(notFoundError('model'));

    return model;
  }

  async listOfferings(d: { modelId?: string; providerSlug?: string }) {
    let where: Prisma.ModelOfferingWhereInput = {
      removedAt: null,
      status: { in: routableModelStatuses },
      model: d.modelId ? { OR: [{ id: d.modelId }, { slug: d.modelId }] } : undefined,
      provider: d.providerSlug ? { slug: d.providerSlug } : undefined
    };

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.modelOffering.findMany({ ...opts, where, include: offeringInclude })
      )
    );
  }
}

export let catalogService = Service.create(
  'catalogService',
  () => new CatalogServiceImpl()
).build();
