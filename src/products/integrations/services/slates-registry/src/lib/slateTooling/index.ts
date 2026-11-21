import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import semver from 'semver';
import {
  getSlatePackageChecksum,
  readZipEntries,
  type SlatePackageEntry
} from '../slatePackage/archive';

export let SLATE_TOOLING_MANIFEST_PATH = 'runtime.json';

export let SLATES_RUNTIME_KIND = 'slates-runtime';

// Packs and upstreams only ever deliver tooling of a kind listed here; anything else is ignored,
// so packs cannot become a generic code-delivery channel.
export let knownToolingKinds: Record<string, { requiredExports: string[] }> = {
  [SLATES_RUNTIME_KIND]: {
    requiredExports: [
      'createProviderHandler',
      'SlatesProviderProtoHandlerManager',
      'serialize'
    ]
  }
};

let kindPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;

let protocolPattern = /^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+$/;

let exportPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

let modulePattern = /\.(js|cjs|mjs)$/;

let toolingManifestSchema = v.object({
  kind: v.string(),
  version: v.string(),
  protocol: v.string(),
  exports: v.array(v.string()),
  main: v.optional(v.string())
});

export type SlateToolingManifest = {
  kind: string;
  version: string;
  protocol: string;
  exports: string[];
  main: string;
};

export type ParsedSlateTooling = {
  manifest: SlateToolingManifest;
  entries: SlatePackageEntry[];
  contentChecksum: string;
};

let invalidTooling = (message: string) => new ServiceError(badRequestError({ message }));

export let isKnownToolingKind = (kind: string) =>
  Object.prototype.hasOwnProperty.call(knownToolingKinds, kind);

export let isValidToolingKind = (kind: string) => kindPattern.test(kind);

export let isValidToolingVersion = (version: string) => semver.valid(version) === version;

export let parseSlateToolingManifest = (content: string): SlateToolingManifest => {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw invalidTooling(`${SLATE_TOOLING_MANIFEST_PATH} is not valid JSON.`);
  }

  let result = toolingManifestSchema.validate(json);
  if (!result.success) {
    throw invalidTooling(
      `${SLATE_TOOLING_MANIFEST_PATH} is invalid: ${result.errors[0]?.message ?? 'unknown error'}`
    );
  }

  let manifest = { ...result.value, main: result.value.main ?? 'index.js' };

  if (!isValidToolingKind(manifest.kind)) {
    throw invalidTooling(`${SLATE_TOOLING_MANIFEST_PATH} has an invalid kind.`);
  }
  if (!isValidToolingVersion(manifest.version)) {
    throw invalidTooling(`${SLATE_TOOLING_MANIFEST_PATH} has an invalid semver version.`);
  }
  if (!protocolPattern.test(manifest.protocol)) {
    throw invalidTooling(`${SLATE_TOOLING_MANIFEST_PATH} has an invalid protocol.`);
  }
  if (!manifest.exports.every(name => exportPattern.test(name))) {
    throw invalidTooling(`${SLATE_TOOLING_MANIFEST_PATH} has an invalid export name.`);
  }
  if (!modulePattern.test(manifest.main) || manifest.main.split('/').includes('..')) {
    throw invalidTooling(`${SLATE_TOOLING_MANIFEST_PATH} has an invalid main module.`);
  }

  return manifest;
};

export let parseSlateToolingArchive = async (d: {
  buffer: Buffer;
  kind: string;
  version: string;
}): Promise<ParsedSlateTooling> => {
  let entries = await readZipEntries(d.buffer, { requireCanonicalPaths: true });

  let manifestEntry = entries.find(entry => entry.path === SLATE_TOOLING_MANIFEST_PATH);
  if (!manifestEntry) {
    throw invalidTooling(`The tooling archive has no ${SLATE_TOOLING_MANIFEST_PATH}.`);
  }

  let manifest = parseSlateToolingManifest(manifestEntry.buffer.toString('utf-8'));

  if (manifest.kind !== d.kind) {
    throw invalidTooling(
      `The archive contains tooling of kind ${manifest.kind}, expected ${d.kind}.`
    );
  }
  if (manifest.version !== d.version) {
    throw invalidTooling(
      `The archive contains version ${manifest.version}, expected ${d.version}.`
    );
  }
  if (!entries.some(entry => entry.path === manifest.main)) {
    throw invalidTooling(`The tooling archive is missing its main module ${manifest.main}.`);
  }

  let missingExports = (knownToolingKinds[manifest.kind]?.requiredExports ?? []).filter(
    name => !manifest.exports.includes(name)
  );
  if (missingExports.length) {
    throw invalidTooling(`The tooling archive does not export ${missingExports.join(', ')}.`);
  }

  return { manifest, entries, contentChecksum: getSlatePackageChecksum(entries) };
};

export let selectToolingVersion = <T extends { version: string; protocol: string }>(d: {
  artifacts: T[];
  protocols: string[];
  version?: string | null;
}) => {
  let supported = d.artifacts.filter(artifact => d.protocols.includes(artifact.protocol));
  if (d.version) return supported.find(artifact => artifact.version === d.version) ?? null;

  return (
    supported
      .filter(artifact => semver.valid(artifact.version))
      .sort((a, b) => semver.rcompare(a.version, b.version))[0] ?? null
  );
};
