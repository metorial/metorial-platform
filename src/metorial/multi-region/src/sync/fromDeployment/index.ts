import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  syncConsumerSurfacesCron,
  syncConsumerSurfaceSingleQueueProcessor,
  syncConsumerSurfacesManyQueueProcessor
} from './consumerSurface';
import {
  syncInstancesCron,
  syncInstanceSingleQueueProcessor,
  syncInstancesManyQueueProcessor
} from './instace';
import {
  syncAppsCron,
  syncAppsManyQueueProcessor,
  syncOAuthAppSingleQueueProcessor
} from './oauth';
import {
  syncOrgsCron,
  syncOrgSingleQueueProcessor,
  syncOrgsManyQueueProcessor
} from './organization';
import {
  syncPortalsCron,
  syncPortalSingleQueueProcessor,
  syncPortalsManyQueueProcessor
} from './portal';
import {
  syncSkillPluginsCron,
  syncSkillPluginSingleQueueProcessor,
  syncSkillPluginsManyQueueProcessor
} from './skillPlugin';
import {
  syncUsersCron,
  syncUserSingleQueueProcessor,
  syncUsersManyQueueProcessor
} from './user';
import {
  syncWorkspacesCron,
  syncWorkspacesManyQueueProcessor,
  syncWorkspacesSingleQueueProcessor
} from './workspace';
import {
  syncWorkspaceGroupsCron,
  syncWorkspaceGroupsManyQueueProcessor,
  syncWorkspaceGroupsSingleQueueProcessor
} from './workspaceGroup';
import {
  syncWorkspaceGroupAssignmentsCron,
  syncWorkspaceGroupAssignmentsManyQueueProcessor,
  syncWorkspaceGroupAssignmentsSingleQueueProcessor
} from './workspaceGroupAssignment';
import {
  syncWorkspaceInvitesCron,
  syncWorkspaceInvitesManyQueueProcessor,
  syncWorkspaceInvitesSingleQueueProcessor
} from './workspaceInvite';
import {
  syncWorkspacePoliciesCron,
  syncWorkspacePoliciesManyQueueProcessor,
  syncWorkspacePoliciesSingleQueueProcessor
} from './workspacePolicy';
import {
  syncWorkspacePolicyAssignmentsCron,
  syncWorkspacePolicyAssignmentsManyQueueProcessor,
  syncWorkspacePolicyAssignmentsSingleQueueProcessor
} from './workspacePolicyAssignment';
import { syncWorkspaceProfilesSingleQueueProcessor } from './workspaceProfile';

export let fromDeploymentSyncProcessors = combineQueueProcessors([
  syncOrgsCron,
  syncOrgsManyQueueProcessor,
  syncOrgSingleQueueProcessor,

  syncUsersCron,
  syncUsersManyQueueProcessor,
  syncUserSingleQueueProcessor,

  syncPortalsCron,
  syncPortalsManyQueueProcessor,
  syncPortalSingleQueueProcessor,

  syncSkillPluginsCron,
  syncSkillPluginsManyQueueProcessor,
  syncSkillPluginSingleQueueProcessor,

  syncConsumerSurfacesCron,
  syncConsumerSurfacesManyQueueProcessor,
  syncConsumerSurfaceSingleQueueProcessor,

  syncAppsCron,
  syncAppsManyQueueProcessor,
  syncOAuthAppSingleQueueProcessor,

  syncWorkspacesCron,
  syncWorkspacesManyQueueProcessor,
  syncWorkspacesSingleQueueProcessor,

  syncWorkspaceGroupsCron,
  syncWorkspaceGroupsManyQueueProcessor,
  syncWorkspaceGroupsSingleQueueProcessor,

  syncWorkspaceGroupAssignmentsCron,
  syncWorkspaceGroupAssignmentsManyQueueProcessor,
  syncWorkspaceGroupAssignmentsSingleQueueProcessor,

  syncWorkspaceInvitesCron,
  syncWorkspaceInvitesManyQueueProcessor,
  syncWorkspaceInvitesSingleQueueProcessor,

  syncWorkspacePoliciesCron,
  syncWorkspacePoliciesManyQueueProcessor,
  syncWorkspacePoliciesSingleQueueProcessor,

  syncWorkspacePolicyAssignmentsCron,
  syncWorkspacePolicyAssignmentsManyQueueProcessor,
  syncWorkspacePolicyAssignmentsSingleQueueProcessor,

  syncInstancesCron,
  syncInstancesManyQueueProcessor,
  syncInstanceSingleQueueProcessor,

  syncWorkspaceProfilesSingleQueueProcessor
]);
