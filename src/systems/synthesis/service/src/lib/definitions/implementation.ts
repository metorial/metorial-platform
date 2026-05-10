import { Agent } from '@openharness/core';
import {
  db,
  Prisma,
} from '../../db';
import type { Assistant, AssistantImplementation, Environment, Tenant } from '../../db';
import { getId } from '../../id';
import type { Model } from './model';

export let implementationModelInclude = {
  provider: true
} satisfies Prisma.ModelInclude;

export type ImplementationModelWithProvider = Prisma.ModelGetPayload<{
  include: typeof implementationModelInclude;
}>;

export let implementation = async (d: {
  defaultModel: Promise<Model>;
  availableModels: Promise<Model>[];
  slug: string;
  name: string;
  getAgent: (d: {
    model: Model;
    tenant: Tenant;
    environment: Environment;
    assistant: Assistant;
    assistantImplementation: AssistantImplementation;
  }) => Promise<Agent>;
}) => {
  let defaultModel = await d.defaultModel;
  let availableModels = Array.from(
    new Map(
      [defaultModel, ...(await Promise.all(d.availableModels))].map(m => [
        m._persisted.oid.toString(),
        m
      ])
    ).values()
  );

  let _persisted = await db.assistantImplementation.upsert({
    where: {
      slug: d.slug
    },
    update: {
      name: d.name
    },
    create: {
      ...getId('assistantImplementation'),
      slug: d.slug,
      name: d.name
    }
  });

  let persistedModels = await db.model.findMany({
    where: {
      oid: { in: availableModels.map(m => m._persisted.oid) }
    },
    include: implementationModelInclude
  });
  let persistedModelByOid = new Map(persistedModels.map(m => [m.oid.toString(), m]));

  return {
    _persisted,
    persistedDefaultModel:
      persistedModelByOid.get(defaultModel._persisted.oid.toString()) ?? null,
    persistedAvailableModels: availableModels
      .map(m => persistedModelByOid.get(m._persisted.oid.toString()))
      .filter((m): m is ImplementationModelWithProvider => !!m),
    ...d,
    defaultModel,
    availableModels
  };
};

export type Implementation = Awaited<ReturnType<typeof implementation>>;
