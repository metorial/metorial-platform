import { dynamicComponent } from '@metorial/dynamic-component';
import type { SkillLinkProvidersScene as _SkillLinkProvidersScene } from './skillLinkProviders';
import type { SkillSettingsScene as _SkillSettingsScene } from './skillSettings';
import type { SkillStoreFileViewerScene as _SkillStoreFileViewerScene } from './skillStoreFileViewer';

export let SkillLinkProvidersScene = dynamicComponent<
  Parameters<typeof _SkillLinkProvidersScene>
>(() => import('./skillLinkProviders').then(m => m.SkillLinkProvidersScene));

export let SkillSettingsScene = dynamicComponent<Parameters<typeof _SkillSettingsScene>>(() =>
  import('./skillSettings').then(m => m.SkillSettingsScene)
);

export let SkillStoreFileViewerScene = dynamicComponent<
  Parameters<typeof _SkillStoreFileViewerScene>
>(() => import('./skillStoreFileViewer').then(m => m.SkillStoreFileViewerScene));
