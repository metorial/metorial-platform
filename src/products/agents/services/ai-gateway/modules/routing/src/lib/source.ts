import { db } from '@mtsrc/ai-gateway-db';
import type { ModelNameSource } from './modelName';

let aliasLookupLimit = 50;

let modelSelect = { slug: true, lab: { select: { slug: true } } } as const;

let toModelRef = (model: { slug: string; lab: { slug: string } } | null | undefined) =>
  model ? { slug: model.slug, labSlug: model.lab.slug } : null;

let aliasesWhere = (where: { raw: string } | { key: string }) =>
  db.modelAlias.findMany({
    where: { ...where, removedAt: null, model: { removedAt: null } },
    select: { namespace: true, model: { select: { slug: true } } },
    take: aliasLookupLimit
  });

export let databaseModelNameSource: ModelNameSource = {
  modelBySlug: async slug =>
    toModelRef(
      await db.model.findFirst({ where: { slug, removedAt: null }, select: modelSelect })
    ),

  aliasesByRaw: async raw =>
    (await aliasesWhere({ raw })).map(alias => ({
      namespace: alias.namespace,
      modelSlug: alias.model.slug
    })),

  aliasesByKey: async key =>
    (await aliasesWhere({ key })).map(alias => ({
      namespace: alias.namespace,
      modelSlug: alias.model.slug
    })),

  modelOfOffering: async d => {
    let offering = await db.modelOffering.findFirst({
      where: {
        vendorModelId: d.vendorModelId,
        removedAt: null,
        provider: { slug: d.providerSlug },
        model: { removedAt: null }
      },
      select: { model: { select: modelSelect } }
    });

    return toModelRef(offering?.model);
  }
};
