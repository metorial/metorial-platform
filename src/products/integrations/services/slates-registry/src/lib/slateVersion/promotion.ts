import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import semver from 'semver';
import type { SlateVersionBackend } from '../../../prisma/generated/client';

export let getSlateVersionPromotion = (d: {
  backend: SlateVersionBackend;
  version: string;
  unbuiltCurrentVersion: string | null;
  builtOrUnbuiltCurrentVersion: string | null;
}) => {
  if (d.backend === 'local_unbuilt') {
    if (d.unbuiltCurrentVersion && !semver.gt(d.version, d.unbuiltCurrentVersion)) {
      throw new ServiceError(
        preconditionFailedError({
          message: `New local_unbuilt version ${d.version} must be greater than existing unbuilt current version ${d.unbuiltCurrentVersion}.`
        })
      );
    }

    return {
      shouldSetUnbuiltCurrentVersion: true,
      shouldSetBuiltOrUnbuiltCurrentVersion:
        !d.builtOrUnbuiltCurrentVersion || semver.gt(d.version, d.builtOrUnbuiltCurrentVersion)
    };
  }

  if (d.backend === 'local_built' || d.backend === 'npm') {
    return {
      shouldSetUnbuiltCurrentVersion: false,
      shouldSetBuiltOrUnbuiltCurrentVersion:
        !d.builtOrUnbuiltCurrentVersion || semver.gt(d.version, d.builtOrUnbuiltCurrentVersion)
    };
  }

  return {
    shouldSetUnbuiltCurrentVersion: false,
    shouldSetBuiltOrUnbuiltCurrentVersion:
      !d.builtOrUnbuiltCurrentVersion || semver.gt(d.version, d.builtOrUnbuiltCurrentVersion)
  };
};
