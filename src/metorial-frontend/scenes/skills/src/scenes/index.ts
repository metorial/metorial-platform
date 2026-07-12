import { dynamicComponent } from '@metorial/dynamic-component';
import type { SkillAgentsScene as _SkillAgentsScene } from './skillAgents';
import type {
  SkillMarketplaceEditorScene as _SkillMarketplaceEditorScene,
  SkillPluginEditorScene as _SkillPluginEditorScene
} from './skillEditor';
import type {
  SkillGroupsForSkillScene as _SkillGroupsForSkillScene,
  SkillGroupSkillsScene as _SkillGroupSkillsScene
} from './skillGroups';
import type {
  SkillLinkProvidersScene as _SkillLinkProvidersScene,
  SkillTemplateLinkProvidersScene as _SkillTemplateLinkProvidersScene
} from './skillLinkProviders';
import type { SkillMarketplacePluginsScene as _SkillMarketplacePluginsScene } from './skillMarketplacePlugins';
import type {
  SkillMarketplaceSettingsScene as _SkillMarketplaceSettingsScene,
  SkillPluginSettingsScene as _SkillPluginSettingsScene
} from './skillMarketplaceSettings';
import type { SkillParticipantsScene as _SkillParticipantsScene } from './skillParticipants';
import type {
  SkillMergeRequestScene as _SkillMergeRequestScene,
  SkillMergeRequestsScene as _SkillMergeRequestsScene
} from './skillMergeRequests';
export { showCreateSkillMergeRequestModal } from './skillMergeRequests';
import type { SkillPluginSkillsScene as _SkillPluginSkillsScene } from './skillPluginSkills';
import type {
  SkillGroupSettingsScene as _SkillGroupSettingsScene,
  SkillSettingsScene as _SkillSettingsScene,
  SkillTemplateSettingsScene as _SkillTemplateSettingsScene
} from './skillSettings';
import type {
  SkillStoreFileViewerScene as _SkillStoreFileViewerScene,
  StoreFileViewerScene as _StoreFileViewerScene
} from './skillStoreFileViewer';
import type { SkillVersionsScene as _SkillVersionsScene } from './skillVersions';
import type { SkillWorkspaceLayout as _SkillWorkspaceLayout } from './skillWorkspaceLayout';

export type { SkillWorkspaceLayoutProps, SkillWorkspaceRoutes } from './skillWorkspaceLayout';

export let SkillLinkProvidersScene = dynamicComponent<
  Parameters<typeof _SkillLinkProvidersScene>
>(() => import('./skillLinkProviders').then(m => m.SkillLinkProvidersScene));

export let SkillAgentsScene = dynamicComponent<Parameters<typeof _SkillAgentsScene>>(() =>
  import('./skillAgents').then(m => m.SkillAgentsScene)
);

export let SkillMarketplaceEditorScene = dynamicComponent<
  Parameters<typeof _SkillMarketplaceEditorScene>
>(() => import('./skillEditor').then(m => m.SkillMarketplaceEditorScene));

export let SkillPluginEditorScene = dynamicComponent<
  Parameters<typeof _SkillPluginEditorScene>
>(() => import('./skillEditor').then(m => m.SkillPluginEditorScene));

export let SkillGroupSkillsScene = dynamicComponent<Parameters<typeof _SkillGroupSkillsScene>>(
  () => import('./skillGroups').then(m => m.SkillGroupSkillsScene)
);

export let SkillGroupsForSkillScene = dynamicComponent<
  Parameters<typeof _SkillGroupsForSkillScene>
>(() => import('./skillGroups').then(m => m.SkillGroupsForSkillScene));

export let SkillMarketplacePluginsScene = dynamicComponent<
  Parameters<typeof _SkillMarketplacePluginsScene>
>(() => import('./skillMarketplacePlugins').then(m => m.SkillMarketplacePluginsScene));

export let SkillPluginSkillsScene = dynamicComponent<
  Parameters<typeof _SkillPluginSkillsScene>
>(() => import('./skillPluginSkills').then(m => m.SkillPluginSkillsScene));

export let SkillParticipantsScene = dynamicComponent<
  Parameters<typeof _SkillParticipantsScene>
>(() => import('./skillParticipants').then(m => m.SkillParticipantsScene));

export let SkillVersionsScene = dynamicComponent<Parameters<typeof _SkillVersionsScene>>(() =>
  import('./skillVersions').then(m => m.SkillVersionsScene)
);

export let SkillMergeRequestsScene = dynamicComponent<
  Parameters<typeof _SkillMergeRequestsScene>
>(() => import('./skillMergeRequests').then(m => m.SkillMergeRequestsScene));

export let SkillMergeRequestScene = dynamicComponent<
  Parameters<typeof _SkillMergeRequestScene>
>(() => import('./skillMergeRequests').then(m => m.SkillMergeRequestScene));

export let SkillTemplateLinkProvidersScene = dynamicComponent<
  Parameters<typeof _SkillTemplateLinkProvidersScene>
>(() => import('./skillLinkProviders').then(m => m.SkillTemplateLinkProvidersScene));

export let SkillSettingsScene = dynamicComponent<Parameters<typeof _SkillSettingsScene>>(() =>
  import('./skillSettings').then(m => m.SkillSettingsScene)
);

export let SkillTemplateSettingsScene = dynamicComponent<
  Parameters<typeof _SkillTemplateSettingsScene>
>(() => import('./skillSettings').then(m => m.SkillTemplateSettingsScene));

export let SkillGroupSettingsScene = dynamicComponent<
  Parameters<typeof _SkillGroupSettingsScene>
>(() => import('./skillSettings').then(m => m.SkillGroupSettingsScene));

export let SkillMarketplaceSettingsScene = dynamicComponent<
  Parameters<typeof _SkillMarketplaceSettingsScene>
>(() => import('./skillMarketplaceSettings').then(m => m.SkillMarketplaceSettingsScene));

export let SkillPluginSettingsScene = dynamicComponent<
  Parameters<typeof _SkillPluginSettingsScene>
>(() => import('./skillMarketplaceSettings').then(m => m.SkillPluginSettingsScene));

export let SkillStoreFileViewerScene = dynamicComponent<
  Parameters<typeof _SkillStoreFileViewerScene>
>(() => import('./skillStoreFileViewer').then(m => m.SkillStoreFileViewerScene));

export let StoreFileViewerScene = dynamicComponent<Parameters<typeof _StoreFileViewerScene>>(
  () => import('./skillStoreFileViewer').then(m => m.StoreFileViewerScene)
);

export let SkillWorkspaceLayout = dynamicComponent<Parameters<typeof _SkillWorkspaceLayout>>(
  () => import('./skillWorkspaceLayout').then(m => m.SkillWorkspaceLayout)
);
