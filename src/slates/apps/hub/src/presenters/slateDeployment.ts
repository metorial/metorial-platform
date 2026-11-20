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

  pendingReason: slateDeployment.pendingReason,
  isCancelledByRedeploy: slateDeployment.isCancelledByRedeploy,
  functionDeploymentId: slateDeployment.providerDeploymentInfo?.functionDeploymentId ?? null,

  slate: slatePresenter(slateDeployment.slate),

  version: slateVersionPresenter({
    ...slateDeployment.slateVersion,
    slate: slateDeployment.slate
  }),

  createdAt: slateDeployment.createdAt,
  updatedAt: slateDeployment.updatedAt,
  endedAt: slateDeployment.endedAt
});

export let slateDeploymentLightPresenter = (slateDeployment: SlateDeployment) => ({
  object: 'slate.deployment#light',

  id: slateDeployment.id,
  status: slateDeployment.status,

  error: slateDeployment.errorCode
    ? {
        code: slateDeployment.errorCode,
        message: slateDeployment.errorMessage ?? slateDeployment.errorCode
      }
    : null,

  pendingReason: slateDeployment.pendingReason,
  isCancelledByRedeploy: slateDeployment.isCancelledByRedeploy,

  createdAt: slateDeployment.createdAt,
  updatedAt: slateDeployment.updatedAt,
  endedAt: slateDeployment.endedAt
});

export let slateDeploymentStepPresenter = (step: {
  id: string;
  name: string;
  type: 'build' | 'deploy';
  status: string;
  logs: { timestamp: number; message: string }[];
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
}) => ({
  object: 'slate.deployment.step',

  id: step.id,
  type: step.type,
  name: step.name,
  status: step.status,

  logs: step.logs.map(l => ({ timestamp: new Date(l.timestamp), message: l.message })),

  createdAt: step.createdAt,
  startedAt: step.startedAt,
  endedAt: step.endedAt
});
