import type {
  LanguageModelV4CallOptions,
  LanguageModelV4Prompt,
  SharedV4ProviderOptions
} from '@ai-sdk/provider';
import type { ProviderConnectionConfig, ProviderCredentials } from '@mtsrc/ai-gateway-spec';
import type { ProviderDefinition } from './definition';
import { providerFetch } from './upstream';

export class ProviderModelUnavailableError extends Error {
  constructor(providerSlug: string) {
    super(`The provider "${providerSlug}" does not serve language models.`);
  }
}

export let createLanguageModelFor = (d: {
  definition: ProviderDefinition;
  credentials: ProviderCredentials;
  config: ProviderConnectionConfig;
  modelId: string;
  fetch?: typeof fetch;
}) => {
  if (!d.definition.languageModel) throw new ProviderModelUnavailableError(d.definition.slug);

  return d.definition.languageModel({
    credentials: d.credentials,
    config: d.config,
    modelId: d.modelId,
    fetch: d.fetch ?? providerFetch
  });
};

let inherit = (
  options: SharedV4ProviderOptions | undefined,
  definition: ProviderDefinition
): SharedV4ProviderOptions | undefined => {
  let key = definition.providerOptionsKey;
  let sources = definition.inheritsProviderOptions ?? [];
  if (!options || !key || !sources.length) return options;

  let inherited = sources.reduce(
    (merged, source) => ({ ...merged, ...options[source] }),
    {} as Record<string, unknown>
  );
  if (!Object.keys(inherited).length) return options;

  return { ...options, [key]: { ...inherited, ...options[key] } } as SharedV4ProviderOptions;
};

let inheritInPrompt = (prompt: LanguageModelV4Prompt, definition: ProviderDefinition) =>
  prompt.map(message => {
    let providerOptions = inherit(message.providerOptions, definition);

    if (typeof message.content == 'string') return { ...message, providerOptions };

    return {
      ...message,
      providerOptions,
      content: message.content.map(part => ({
        ...part,
        providerOptions: inherit(part.providerOptions, definition)
      }))
    };
  }) as LanguageModelV4Prompt;

export let prepareCallOptions = <
  Options extends Omit<LanguageModelV4CallOptions, 'abortSignal'>
>(
  options: Options,
  definition: ProviderDefinition
): Options => {
  let providerOptions = inherit(options.providerOptions, definition) ?? {};

  for (let [namespace, enforced] of Object.entries(definition.enforcedProviderOptions ?? {})) {
    providerOptions = {
      ...providerOptions,
      [namespace]: { ...providerOptions[namespace], ...enforced }
    };
  }

  return {
    ...options,
    prompt: inheritInPrompt(options.prompt, definition),
    tools: options.tools?.map(tool =>
      tool.type == 'function'
        ? { ...tool, providerOptions: inherit(tool.providerOptions, definition) }
        : tool
    ),
    providerOptions: Object.keys(providerOptions).length ? providerOptions : undefined
  };
};
