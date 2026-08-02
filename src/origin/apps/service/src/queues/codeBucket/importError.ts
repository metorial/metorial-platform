import { delay } from '@lowerdeck/delay';
import { db } from '../../db';
import {
  formatScmProviderPublicError,
  getScmProviderErrorDetails,
  getScmProviderLogDetails,
  isRetryableScmProviderError,
  wrapScmProviderError
} from '../../lib/scmProviderError';

type ScmProvider = 'github' | 'gitlab' | 'bitbucket';

let providerLabel = (provider: ScmProvider) =>
  provider === 'github' ? 'GitHub' : provider === 'gitlab' ? 'GitLab' : 'Bitbucket';

export let getCodeBucketImportFailureMessage = (
  provider: ScmProvider,
  error: unknown
) => {
  let details = getScmProviderErrorDetails(error);
  if (details.classification === 'resource_not_found') {
    return `${providerLabel(provider)} repository was not found. It may have been deleted, renamed, or the installation may lack access.`;
  }
  if (details.classification === 'missing_branch') {
    return `${providerLabel(provider)} could not import the repository: the requested branch or ref was not found.`;
  }
  if (details.classification === 'permission_denied') {
    return `${providerLabel(provider)} could not import the repository: the installation lacks permission.`;
  }
  if (details.classification === 'authentication_failed') {
    return `${providerLabel(provider)} could not import the repository: authentication failed.`;
  }

  return formatScmProviderPublicError({
    provider,
    operation: 'import the repository',
    error
  });
};

export let runCodeBucketImport = async (d: {
  provider: ScmProvider;
  bucketId: string;
  context?: Record<string, unknown>;
  importFn: () => Promise<void>;
}) => {
  try {
    await d.importFn();
    await delay(2000);
    await db.codeBucket.updateMany({
      where: { id: d.bucketId },
      data: { status: 'ready', errorMessage: null }
    });
  } catch (error) {
    let wrapped = wrapScmProviderError(d.provider, error, 'import the repository', {
      context: d.context
    });

    if (isRetryableScmProviderError(error) || isRetryableScmProviderError(wrapped)) {
      throw wrapped;
    }

    let message = getCodeBucketImportFailureMessage(d.provider, error);
    console.error(
      JSON.stringify({
        event: 'code_bucket_import_failed',
        level: 'error',
        provider: d.provider,
        bucketId: d.bucketId,
        message,
        context: d.context,
        providerDiagnostic: getScmProviderLogDetails(wrapped)
      })
    );

    await db.codeBucket.updateMany({
      where: { id: d.bucketId },
      data: { status: 'failed', errorMessage: message }
    });
  }
};
