import { v } from '@lowerdeck/validation';
import { env } from '../../env';

export type StaticUpstreamConfig = {
  identifier: string;
  name: string;
  url: string;
  subRegistryId: string | null;
};

let staticUpstreamSchema = v.array(
  v.object({
    url: v.string(),
    subRegistryId: v.optional(v.nullable(v.string())),
    identifier: v.optional(v.string()),
    name: v.optional(v.string())
  })
);

export let normalizeUpstreamUrl = (input: string) => {
  let url = new URL(input);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Unsupported upstream registry protocol: ${url.protocol}`);
  }

  return url.toString().replace(/\/+$/, '');
};

export let parseStaticUpstreams = (): StaticUpstreamConfig[] => {
  let raw = env.mirror.SLATES_UPSTREAM_REGISTRIES?.trim();
  if (!raw) return [];

  let result = staticUpstreamSchema.validate(JSON.parse(raw));
  if (!result.success) {
    throw new Error(
      `Invalid SLATES_UPSTREAM_REGISTRIES: ${result.errors[0]?.message ?? 'unknown error'}`
    );
  }

  return result.value.map((upstream, index) => {
    let url = normalizeUpstreamUrl(upstream.url);
    let subRegistryId = upstream.subRegistryId ?? null;

    return {
      identifier: upstream.identifier ?? `static-${index + 1}`,
      name: upstream.name ?? (subRegistryId ? `${new URL(url).host} (${subRegistryId})` : url),
      url,
      subRegistryId
    };
  });
};
