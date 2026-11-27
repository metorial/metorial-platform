import type {
  Registry,
  Slate,
  SlateDeployment,
  SlateEvent,
  SlateSpecification,
  SlateVersion,
  SlateVersionDiscovery
} from '../../prisma/generated/client';
import { slatePresenter } from './slate';
import { slateDeploymentPresenter } from './slateDeployment';
import { slateVersionDiscoveryPresenter } from './slateDiscovery';
import { slateVersionPresenter } from './slateVersion';

export let slateEventPresenter = (
  evt: SlateEvent & {
    slateVersion: SlateVersion & {
      specification: SlateSpecification | null;
      activeDeployment?:
        | (SlateDeployment & {
            slateVersion: SlateVersion & { specification: SlateSpecification | null };
          })
        | null;
      slateVersionDiscoveries?: (SlateVersionDiscovery & {
        slateVersion: SlateVersion & { specification: SlateSpecification | null };
      })[];
    };
    slate: Slate & {
      registry: Registry;
      currentVersion: (SlateVersion & { specification: SlateSpecification | null }) | null;
    };
  }
) => {
  let deployment = evt.slateVersion.activeDeployment;
  let discovery = evt.slateVersion.slateVersionDiscoveries?.[0];

  return {
    object: 'slate.event',

    id: evt.id,
    type: evt.type,
    message: evt.message,

    slate: slatePresenter(evt.slate),

    version: slateVersionPresenter({ ...evt.slateVersion, slate: evt.slate }),

    deployment: deployment
      ? slateDeploymentPresenter({ ...deployment, slate: evt.slate })
      : null,

    discovery: discovery
      ? slateVersionDiscoveryPresenter({
          ...discovery,
          slateVersion: { ...discovery.slateVersion, slate: evt.slate }
        })
      : null,

    createdAt: evt.createdAt
  };
};
