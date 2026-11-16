import { badRequestError, ServiceError } from '@lowerdeck/error';

export let getGitLabNamespaceId = (externalAccountId: string) => {
  if (!/^\d+$/.test(externalAccountId)) {
    throw new ServiceError(
      badRequestError({ message: 'GitLab namespace ID must be a positive integer' })
    );
  }

  let namespaceId = Number(externalAccountId);
  if (!Number.isSafeInteger(namespaceId) || namespaceId <= 0) {
    throw new ServiceError(
      badRequestError({ message: 'GitLab namespace ID must be a positive integer' })
    );
  }

  return namespaceId;
};

export let getGitLabPersonalNamespaceId = (user: {
  username?: string | null;
  namespaceId?: number | string | null;
  namespace_id?: number | string | null;
}, namespaces: { id: number | string; kind?: string; path?: string }[] = []) => {
  let namespaceId =
    user.namespaceId ??
    user.namespace_id ??
    namespaces.find(namespace => namespace.kind === 'user' && namespace.path === user.username)?.id;
  if (namespaceId == null) {
    throw new ServiceError(
      badRequestError({ message: 'GitLab account does not have a personal namespace' })
    );
  }

  return getGitLabNamespaceId(namespaceId.toString());
};

export let isGitLabNamespaceError = (error: any) =>
  JSON.stringify(error?.cause?.description ?? error?.description ?? error?.message ?? '').includes(
    'namespace'
  );
