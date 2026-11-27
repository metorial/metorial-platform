// export * from './editor';

import { dynamicComponent } from '@metorial/dynamic-component';
import type { CodeEditor as _CodeEditor } from './editor';
import type { MergeEditor as _MergeEditor } from './mergeEditor';

export let CodeEditor = dynamicComponent<Parameters<typeof _CodeEditor>>(() =>
  import('./editor').then(m => m.CodeEditor)
);

export let MergeEditor = dynamicComponent<Parameters<typeof _MergeEditor>>(() =>
  import('./mergeEditor').then(m => m.MergeEditor)
);
