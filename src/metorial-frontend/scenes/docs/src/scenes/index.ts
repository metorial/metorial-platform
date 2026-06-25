import { dynamicComponent } from '@metorial/dynamic-component';
import type { DocumentEditorScene as _DocumentEditorScene } from './documentEditor';

export type { DocumentEditorSceneProps } from './documentEditor';

export let DocumentEditorScene = dynamicComponent<Parameters<typeof _DocumentEditorScene>>(
  () => import('./documentEditor').then(m => m.DocumentEditorScene)
);
