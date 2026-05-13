import { dynamicComponent } from '@metorial/dynamic-component';
import type { SkillGroupSkillsScene as _SkillGroupSkillsScene } from './skillGroups';
import type { SkillGroupsForSkillScene as _SkillGroupsForSkillScene } from './skillGroups';
import type { SkillLinkProvidersScene as _SkillLinkProvidersScene } from './skillLinkProviders';
import type { SkillTemplateLinkProvidersScene as _SkillTemplateLinkProvidersScene } from './skillLinkProviders';
import type { SkillGroupSettingsScene as _SkillGroupSettingsScene } from './skillSettings';
import type { SkillSettingsScene as _SkillSettingsScene } from './skillSettings';
import type { SkillTemplateSettingsScene as _SkillTemplateSettingsScene } from './skillSettings';
import type { StoreFileViewerScene as _StoreFileViewerScene } from './skillStoreFileViewer';
import type { SkillStoreFileViewerScene as _SkillStoreFileViewerScene } from './skillStoreFileViewer';

export let SkillLinkProvidersScene = dynamicComponent<
  Parameters<typeof _SkillLinkProvidersScene>
>(() => import('./skillLinkProviders').then(m => m.SkillLinkProvidersScene));

export let SkillGroupSkillsScene = dynamicComponent<Parameters<typeof _SkillGroupSkillsScene>>(
  () => import('./skillGroups').then(m => m.SkillGroupSkillsScene)
);

export let SkillGroupsForSkillScene = dynamicComponent<
  Parameters<typeof _SkillGroupsForSkillScene>
>(() => import('./skillGroups').then(m => m.SkillGroupsForSkillScene));

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

export let SkillStoreFileViewerScene = dynamicComponent<
  Parameters<typeof _SkillStoreFileViewerScene>
>(() => import('./skillStoreFileViewer').then(m => m.SkillStoreFileViewerScene));

export let StoreFileViewerScene = dynamicComponent<Parameters<typeof _StoreFileViewerScene>>(
  () => import('./skillStoreFileViewer').then(m => m.StoreFileViewerScene)
);
