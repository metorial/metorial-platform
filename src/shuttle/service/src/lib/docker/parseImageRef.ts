export interface ParsedImageRef {
  registry: string;
  repository: string;
  tag?: string;
  digest?: string;
  canonicalName: string;
}

export let parseDockerImageRef = (input: string): ParsedImageRef => {
  let registry = 'registry-1.docker.io';
  let remainder = input;
  let tag: string | undefined;
  let digest: string | undefined;

  let digestIndex = remainder.indexOf('@');
  if (digestIndex !== -1) {
    digest = remainder.slice(digestIndex + 1);
    remainder = remainder.slice(0, digestIndex);
  }

  let lastColon = remainder.lastIndexOf(':');
  let lastSlash = remainder.lastIndexOf('/');
  if (lastColon > lastSlash) {
    tag = remainder.slice(lastColon + 1);
    remainder = remainder.slice(0, lastColon);
  }

  let firstSlash = remainder.indexOf('/');
  if (firstSlash !== -1) {
    let firstSegment = remainder.slice(0, firstSlash);
    if (
      firstSegment.includes('.') ||
      firstSegment.includes(':') ||
      firstSegment === 'localhost'
    ) {
      registry = firstSegment;
      remainder = remainder.slice(firstSlash + 1);
    }
  }

  if (!remainder.includes('/')) {
    remainder = `library/${remainder}`;
  }

  if (!tag && !digest) tag = 'latest';

  let repository = remainder;
  let canonicalName = `${registry}/${repository}`;
  if (tag) canonicalName += `:${tag}`;
  if (digest) canonicalName += `@${digest}`;

  return {
    registry,
    repository,
    tag,
    digest,
    canonicalName
  };
};
