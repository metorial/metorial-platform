import { dynamicComponent } from '@metorial/dynamic-component';
import type { MonacoCodeEditor as _MonacoCodeEditor } from './monacoEditor';

export type { MonacoCodeEditorHandle, MonacoCodeEditorProps } from './monacoEditor';

export let MonacoCodeEditor = dynamicComponent<Parameters<typeof _MonacoCodeEditor>>(() =>
  import('./monacoEditor').then(module => module.MonacoCodeEditor)
);
