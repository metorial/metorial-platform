import { dynamicComponent } from '@metorial/dynamic-component';
import type { CodeBlock as _CodeBlock } from './_import';

export let CodeBlock = dynamicComponent<Parameters<typeof _CodeBlock>>(() =>
  import('./_import').then(m => m.CodeBlock)
);
