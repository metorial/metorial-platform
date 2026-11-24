import type { VirtualModelDefinition } from '@mtsrc/ai-gateway-spec';
import { compileDefinition, type CompiledDefinition } from './cel';

let maxEntries = 1000;

let compiled = new Map<string, CompiledDefinition>();

export let compiledDefinitionFor = (versionId: string, definition: VirtualModelDefinition) => {
  let cached = compiled.get(versionId);
  if (cached) {
    compiled.delete(versionId);
    compiled.set(versionId, cached);
    return cached;
  }

  let fresh = compileDefinition(definition);
  compiled.set(versionId, fresh);
  if (compiled.size > maxEntries) compiled.delete(compiled.keys().next().value!);

  return fresh;
};
