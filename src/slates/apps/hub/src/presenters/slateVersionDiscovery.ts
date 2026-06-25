import type {
  Slate,
  SlateInvocation,
  SlateSpecification,
  SlateVersion,
  SlateVersionDiscovery
} from '../../prisma/generated/client';

export let slateVersionDiscoveryPresenter = (
  discovery: SlateVersionDiscovery & {
    slateVersion: SlateVersion & {
      slate: Slate;
    };
    specification: SlateSpecification | null;
    invocation: SlateInvocation | null;
  }
) => ({
  object: 'slate.version_discovery',

  id: discovery.id,

  slateVersionId: discovery.slateVersion.id,
  slateInvocationId: discovery.invocation?.id,
  specificationId: discovery.specification?.id,

  error: discovery.errorMessage
    ? {
        code: 'version_discovery_error',
        message: discovery.errorMessage
      }
    : undefined,

  createdAt: discovery.createdAt
});
