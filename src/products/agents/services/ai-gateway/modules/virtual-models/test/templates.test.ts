import { describe, expect, it } from 'vitest';
import { allVirtualModelTemplates } from '../src/definitions/templates';
import { compileDefinition } from '../src/lib/cel';
import { definitionTargets, parseDefinition } from '../src/lib/definition';

describe('virtual model templates', () => {
  for (let template of allVirtualModelTemplates) {
    it(`${template.slug} builds a valid definition from its parameters`, () => {
      let models = Object.fromEntries(
        template.parameters.map(parameter => [parameter.key, `lab/${parameter.key}`])
      );

      let definition = parseDefinition(template.build(models));

      expect(() => compileDefinition(definition)).not.toThrow();
      expect(definitionTargets(definition).sort()).toEqual(Object.values(models).sort());
    });
  }
});
