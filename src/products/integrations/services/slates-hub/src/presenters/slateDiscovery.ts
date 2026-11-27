import type {
  Registry,
  Slate,
  SlateVersionDiscovery,
  SlateSpecification,
  SlateVersion
} from '../../prisma/generated/client';
import { slatePresenter } from './slate';
import { slateVersionPresenter } from './slateVersion';

export let slateVersionDiscoveryPresenter = (
  slateVersionDiscovery: SlateVersionDiscovery & {
    slateVersion: SlateVersion & {
      specification: SlateSpecification | null;
      slate: Slate & {
        registry: Registry;
        currentVersion: (SlateVersion & { specification: SlateSpecification | null }) | null;
      };
    };
  }
) => ({
  object: 'slate.discovery',

  id: slateVersionDiscovery.id,
  status: slateVersionDiscovery.status,

  error: slateVersionDiscovery.errorCode
    ? {
        code: slateVersionDiscovery.errorCode,
        message: slateVersionDiscovery.errorMessage ?? slateVersionDiscovery.errorCode
      }
    : null,

  slate: slatePresenter(slateVersionDiscovery.slateVersion.slate),

  version: slateVersionPresenter({
    ...slateVersionDiscovery.slateVersion,
    slate: slateVersionDiscovery.slateVersion.slate
  }),

  createdAt: slateVersionDiscovery.createdAt
});
