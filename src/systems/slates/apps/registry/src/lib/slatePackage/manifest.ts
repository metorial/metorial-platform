import { badRequestError, ServiceError, validationError } from '@lowerdeck/error';
import { type ValidationTypeValue, v } from '@lowerdeck/validation';
import semver from 'semver';
import type { SlatePackageEntry } from './archive';

export type NormalizedSlatePackage = {
  docsFiles: {
    path: string;
    content: string;
  }[];
  npmPackageName: string;
  fullIdentifier: string;
  scopeIdentifier: string;
  slateIdentifier: string;
  manifest: ValidationTypeValue<typeof slateJsonValidation>;
};

let rawSlateJsonValidation = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  categories: v.optional(v.array(v.string())),
  skills: v.optional(v.array(v.string())),
  logoUrl: v.optional(v.string())
});

let packageJsonValidation = v.object({
  name: v.string(),
  version: v.string({
    modifiers: [
      value => {
        if (!semver.valid(value)) {
          return [
            {
              code: 'invalid_semver',
              message: 'Version is not a valid semver string.'
            }
          ];
        }

        return [];
      }
    ]
  }),
  description: v.optional(v.string())
});

export let slateJsonValidation = v.object({
  name: v.string(),
  version: v.string({
    modifiers: [
      value => {
        if (!semver.valid(value)) {
          return [
            {
              code: 'invalid_semver',
              message: 'Version is not a valid semver string.'
            }
          ];
        }

        return [];
      }
    ]
  }),
  description: v.optional(v.string()),
  categories: v.optional(v.array(v.string())),
  skills: v.optional(v.array(v.string())),
  logoUrl: v.optional(v.string())
});

let parseJsonFile = <T>(d: {
  content: string;
  path: string;
  validation: {
    validate: (
      value: unknown
    ) => { success: true; value: T } | { success: false; errors: unknown };
  };
}) => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(d.content);
  } catch {
    throw new ServiceError(
      badRequestError({
        message: `${d.path} is not valid JSON.`
      })
    );
  }

  let validationResult = d.validation.validate(parsed);
  if (!validationResult.success) {
    throw new ServiceError(
      validationError({
        message: `${d.path} is invalid.`,
        entity: d.path,
        errors: validationResult.errors as never
      })
    );
  }

  return validationResult.value;
};

export let normalizeSlatePackage = (d: {
  entries: SlatePackageEntry[];
  identifier: {
    scopeIdentifier: string;
    slateIdentifier: string;
  } | null;
  versionOverride?: string;
}) => {
  let docsFiles: {
    path: string;
    content: string;
  }[] = [];
  let rawSlateJson: ValidationTypeValue<typeof rawSlateJsonValidation> | null = null;
  let packageJson: ValidationTypeValue<typeof packageJsonValidation> | null = null;

  for (let entry of d.entries) {
    let lowerPath = entry.path.toLowerCase();

    if (lowerPath === 'slate.json') {
      rawSlateJson = parseJsonFile({
        content: entry.buffer.toString('utf-8'),
        path: 'slate.json',
        validation: rawSlateJsonValidation
      });
    }

    if (lowerPath === 'package.json') {
      packageJson = parseJsonFile({
        content: entry.buffer.toString('utf-8'),
        path: 'package.json',
        validation: packageJsonValidation
      });
    }

    if (
      (!entry.path.startsWith('docs/') || !lowerPath.endsWith('.md')) &&
      lowerPath !== 'readme.md'
    ) {
      continue;
    }

    docsFiles.push({
      path: entry.path,
      content: entry.buffer.toString('utf-8')
    });
  }

  if (!rawSlateJson) {
    throw new ServiceError(
      badRequestError({
        message: 'slate.json is required in the root of the project archive.'
      })
    );
  }

  if (!packageJson) {
    throw new ServiceError(
      badRequestError({
        message: 'package.json is required in the root of the project archive.'
      })
    );
  }

  if (d.versionOverride && d.versionOverride !== packageJson.version) {
    throw new ServiceError(
      badRequestError({
        message: 'Requested version must match package.json version.'
      })
    );
  }

  let normalizedVersion = semver.valid(packageJson.version);
  if (!normalizedVersion) {
    throw new ServiceError(
      badRequestError({
        message: `Version ${packageJson.version} is not a valid semver version.`
      })
    );
  }

  let manifest = {
    name: rawSlateJson.name,
    version: normalizedVersion,
    description: rawSlateJson.description ?? packageJson.description,
    categories: rawSlateJson.categories,
    skills: rawSlateJson.skills,
    logoUrl: rawSlateJson.logoUrl
  } satisfies ValidationTypeValue<typeof slateJsonValidation>;

  let validationResult = slateJsonValidation.validate(manifest);
  if (!validationResult.success) {
    throw new ServiceError(
      validationError({
        message: 'Normalized slate metadata is invalid.',
        entity: 'slate.json',
        errors: validationResult.errors as never
      })
    );
  }

  if (d.identifier) {
    let expectedName = `@${d.identifier.scopeIdentifier}/${d.identifier.slateIdentifier}`;
    if (manifest.name !== expectedName) {
      throw new ServiceError(
        badRequestError({
          message: `Package name "${manifest.name}" does not match scope/slate identifier.`
        })
      );
    }
  }

  let fullIdentifier = manifest.name.replace('@', '');
  let fullParts = fullIdentifier.split('/');

  if (fullParts.length !== 2) {
    throw new ServiceError(
      badRequestError({
        message: 'Package name must be in the format @scope/identifier.'
      })
    );
  }

  return {
    docsFiles,
    npmPackageName: packageJson.name,
    fullIdentifier,
    scopeIdentifier: fullParts[0]!,
    slateIdentifier: fullParts[1]!,
    manifest
  } satisfies NormalizedSlatePackage;
};
