import type { ValidationType } from '@lowerdeck/validation';
import type {
  Instance,
  ProductAssistant,
  ProductAssistantImplementation,
  ProductAssistantInstance,
  Project,
  ResourceActor
} from '@metorial/db';
import { db, ID, Prisma } from '@metorial/db';
import { Agent } from '../open-harness';
import type { Model } from './model';

export let implementationModelInclude = {
  provider: true
} satisfies Prisma.ProductAssistantModelInclude;

export type ImplementationModelWithProvider = Prisma.ProductAssistantModelGetPayload<{
  include: typeof implementationModelInclude;
}>;

type MaybePromise<T> = T | Promise<T>;

type ImplementationBase = {
  defaultModel: Promise<Model>;
  availableModels: Promise<Model>[];
  slug: string;
  name: string;
};

export type ImplementationHandleInputContext<Input> = {
  input: Input;
  project: Project;
  instance: Instance;
  actor: ResourceActor;
  assistant: ProductAssistant;
  assistantInstance: ProductAssistantInstance;
  assistantImplementation: ProductAssistantImplementation;
};

export type ImplementationGetAgentContext<Input> = {
  input: Input;
  model: Model;
  project: Project;
  instance: Instance;
  assistant: ProductAssistant;
  assistantInstance: ProductAssistantInstance;
  assistantImplementation: ProductAssistantImplementation;
};

type ImplementationWithoutInput = ImplementationBase & {
  input?: undefined;
  handleInput?: undefined;
  getAgent: (
    d: {
      input: undefined;
    } & Omit<ImplementationGetAgentContext<undefined>, 'input'>
  ) => Promise<Agent>;
};

type ImplementationWithInput<Input, HandledInput> = ImplementationBase & {
  input: ValidationType<Input>;
  handleInput: (d: ImplementationHandleInputContext<Input>) => MaybePromise<HandledInput>;
  getAgent: (d: ImplementationGetAgentContext<HandledInput>) => Promise<Agent>;
};

export type ImplementationDefinition<Input = undefined, HandledInput = Input> =
  | ImplementationWithoutInput
  | ImplementationWithInput<Input, HandledInput>;

type PersistedImplementationBase = Omit<
  ImplementationBase,
  'defaultModel' | 'availableModels'
> & {
  _persisted: ProductAssistantImplementation;
  persistedDefaultModel: ImplementationModelWithProvider | null;
  persistedAvailableModels: ImplementationModelWithProvider[];
  defaultModel: Model;
  availableModels: Model[];
};

export type ImplementationWithoutInputResult = PersistedImplementationBase &
  Omit<ImplementationWithoutInput, 'defaultModel' | 'availableModels'>;

export type ImplementationWithInputResult<Input, HandledInput> = PersistedImplementationBase &
  Omit<ImplementationWithInput<Input, HandledInput>, 'defaultModel' | 'availableModels'>;

export type Implementation =
  | ImplementationWithoutInputResult
  | ImplementationWithInputResult<any, any>;

type ImplementationFactory = {
  (d: ImplementationWithoutInput): Promise<ImplementationWithoutInputResult>;
  <Input, HandledInput>(
    d: ImplementationWithInput<Input, HandledInput>
  ): Promise<ImplementationWithInputResult<Input, HandledInput>>;
};

let buildImplementation = async (
  d: ImplementationDefinition<any, any>
): Promise<Implementation> => {
  let defaultModel = await d.defaultModel;
  let availableModels = Array.from(
    new Map(
      [defaultModel, ...(await Promise.all(d.availableModels))].map(m => [
        m._persisted.oid.toString(),
        m
      ])
    ).values()
  );

  let _persisted = await db.productAssistantImplementation.upsert({
    where: {
      slug: d.slug
    },
    update: {
      name: d.name
    },
    create: {
      id: await ID.generateId('productAssistantImplementation'),
      slug: d.slug,
      name: d.name
    }
  });

  let persistedModels = await db.productAssistantModel.findMany({
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

export let implementation = buildImplementation as ImplementationFactory;
