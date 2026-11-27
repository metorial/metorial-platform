export type SessionProviderNameTemplateTarget = {
  id: string;
  nameTemplate: string | null;
};

export type SessionProviderNameTemplateMatch<
  Provider extends SessionProviderNameTemplateTarget
> = {
  provider: Provider;
  originalName: string;
  finalName: string;
};

let normalizeTemplatePrefix = (name: string) => {
  let normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'provider';
};

export let buildBaseSessionProviderNameTemplate = (providerName: string) =>
  `${normalizeTemplatePrefix(providerName)}_$`;

export let buildFallbackSessionProviderNameTemplate = (providerName: string, suffix: string) =>
  `${normalizeTemplatePrefix(providerName)}_$_${suffix.trim().toLowerCase()}`;

export let parseSessionProviderNameTemplate = (template: string) => {
  let parts = template.split('$');
  if (parts.length !== 2) {
    throw new Error(`Invalid session provider name template: ${template}`);
  }

  return {
    prefix: parts[0]!,
    suffix: parts[1]!
  };
};

export let applySessionProviderNameTemplate = (template: string, originalName: string) => {
  let { prefix, suffix } = parseSessionProviderNameTemplate(template);
  return `${prefix}${originalName}${suffix}`;
};

export let parseNameFromSessionProviderTemplates = <
  Provider extends SessionProviderNameTemplateTarget
>(
  finalName: string,
  providers: Provider[]
): SessionProviderNameTemplateMatch<Provider> | null => {
  let candidates = providers
    .map(provider => {
      if (!provider.nameTemplate) return null;

      let { prefix, suffix } = parseSessionProviderNameTemplate(provider.nameTemplate);

      if (!finalName.startsWith(prefix)) return null;
      if (suffix !== '' && !finalName.endsWith(suffix)) return null;

      let start = prefix.length;
      let end = suffix === '' ? finalName.length : finalName.length - suffix.length;
      if (end < start) return null;

      let originalName = finalName.slice(start, end);
      if (originalName.length === 0) return null;

      return {
        provider,
        originalName,
        finalName,
        specificity: prefix.length + suffix.length
      };
    })
    .filter(
      (
        candidate
      ): candidate is SessionProviderNameTemplateMatch<Provider> & {
        specificity: number;
      } => candidate !== null
    );

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.specificity - a.specificity);

  let best = candidates[0]!;
  let second = candidates[1];

  if (second && second.specificity === best.specificity) {
    throw new Error(`Ambiguous session provider name: ${finalName}`);
  }

  return {
    provider: best.provider,
    originalName: best.originalName,
    finalName: best.finalName
  };
};
