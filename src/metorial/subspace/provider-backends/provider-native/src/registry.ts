import type {
  Environment,
  Session,
  SessionConnection,
  SessionMessage,
  Solution,
  Tenant
} from '@metorial-subspace/db';
import z from 'zod';

export type NativeToolContext = {
  environment: Environment;
  tenant: Tenant;
  solution: Solution;
  message: SessionMessage;
  session: Session;
  connection: SessionConnection;
};

export type NativeToolHandler<TInput, TOutput> = (
  input: TInput,
  ctx: NativeToolContext
) => Promise<TOutput> | TOutput;

export type NativeTool<
  TInputSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny | undefined = z.ZodTypeAny | undefined
> = {
  key: string;
  name: string;
  description?: string;
  input: TInputSchema;
  inputJsonSchema: Record<string, any>;
  output?: TOutputSchema;
  outputJsonSchema?: Record<string, any>;
  constraints: string[];
  instructions: string[];
  metadata: Record<string, any>;
  tags?: {
    destructive?: boolean | undefined;
    readOnly?: boolean | undefined;
  };
  invoke: NativeToolHandler<
    z.output<TInputSchema>,
    TOutputSchema extends z.ZodTypeAny ? z.output<TOutputSchema> : Record<string, any>
  >;
};

export type NativeIntegration = {
  identifier: string;
  name: string;
  description: string;
  readme?: string;
  logoUrl?: string;
  tools: NativeTool[];
};

let integrations = new Map<string, NativeIntegration>();
let resyncHandler: (() => Promise<void>) | null = null;

export let zodToJsonSchema = (schema: z.ZodTypeAny) =>
  z.toJSONSchema(schema) as Record<string, any>;

export let createTool = <
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny | undefined = undefined
>(
  config: {
    key: string;
    name?: string;
    description?: string;
    input: TInputSchema;
    output?: TOutputSchema;
    constraints?: string[];
    instructions?: string[];
    metadata?: Record<string, any>;
    tags?: {
      destructive?: boolean | undefined;
      readOnly?: boolean | undefined;
    };
  },
  handler: NativeToolHandler<
    z.output<TInputSchema>,
    TOutputSchema extends z.ZodTypeAny ? z.output<TOutputSchema> : Record<string, any>
  >
): NativeTool<TInputSchema, TOutputSchema> => ({
  key: config.key,
  name: config.name ?? config.key,
  description: config.description,
  input: config.input,
  inputJsonSchema: zodToJsonSchema(config.input),
  output: config.output,
  outputJsonSchema: config.output ? zodToJsonSchema(config.output) : undefined,
  constraints: config.constraints ?? [],
  instructions: config.instructions ?? [],
  metadata: config.metadata ?? {},
  tags: config.tags,
  invoke: handler
});

export let setNativeIntegrationResyncHandler = (handler: (() => Promise<void>) | null) => {
  resyncHandler = handler;
};

export let createIntegration = (integration: NativeIntegration): NativeIntegration => {
  if (integrations.has(integration.identifier)) {
    throw new Error(`Native integration already registered: ${integration.identifier}`);
  }

  integrations.set(integration.identifier, integration);

  if (resyncHandler) {
    void resyncHandler();
  }

  return integration;
};

export let listNativeIntegrations = () => Array.from(integrations.values());

export let getNativeIntegration = (identifier: string) => integrations.get(identifier) ?? null;

export { z };
