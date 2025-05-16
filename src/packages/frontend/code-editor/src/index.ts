// export * from './editor';

import { dynamicComponent } from '@metorial/dynamic-component';
import type { CodeEditor as _CodeEditor } from './editor';

export let CodeEditor = dynamicComponent<Parameters<typeof _CodeEditor>>(() =>
  import('./editor').then(m => m.CodeEditor)
);
