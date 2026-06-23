import type {
  Registry,
  Slate,
  SlateDeployment,
  SlateSpecification,
  SlateVersion
} from '../../prisma/generated/client';
import { slatePresenter } from './slate';
import { slateVersionPresenter } from './slateVersion';

export let slateDeploymentPresenter = (
  slateDeployment: SlateDeployment & {
    slate: Slate & {
      registry: Registry;
      currentVersion: (SlateVersion & { specification: SlateSpecification | null }) | null;
    };
    slateVersion: SlateVersion & {
      specification: SlateSpecification | null;
    };
  }
) => ({
  object: 'slate.deployment',

  id: slateDeployment.id,
  status: slateDeployment.status,

  error: slateDeployment.errorCode
    ? {
        code: slateDeployment.errorCode,
        message: slateDeployment.errorMessage ?? slateDeployment.errorCode
      }
    : null,

  slate: slatePresenter(slateDeployment.slate),

  version: slateVersionPresenter({
    ...slateDeployment.slateVersion,
    slate: slateDeployment.slate
  }),

  createdAt: slateDeployment.createdAt
});
