import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src';
import { validateCatalog } from '../src/pipeline/validate';
import { fixturePath, noOverrides, now } from './helpers';

describe('validateCatalog', () => {
  it('flags duplicates, dangling references and negative prices', async () => {
    let { catalog } = await buildCatalog({
      modelsDevPath: fixturePath,
      previousDir: null,
      offline: true,
      now,
      overrides: noOverrides
    });
    let [first] = catalog.offerings;

    let broken = {
      ...catalog,
      models: [...catalog.models, catalog.models[0]!],
      offerings: [
        ...catalog.offerings,
        { ...first!, id: 'x:dangling', modelId: 'acme/missing' },
        {
          ...first!,
          id: 'x:negative',
          pricing: { ...first!.pricing!, text: { ...first!.pricing!.text!, input: -1 } }
        }
      ],
      names: [
        ...catalog.names,
        {
          ...catalog.names[0]!,
          id: 'x:name',
          target: { kind: 'pointer' as const, pointerId: 'nope' }
        }
      ]
    };

    let { errors } = validateCatalog(broken);

    expect(errors).toContain(`duplicate model id ${catalog.models[0]!.id}`);
    expect(errors).toContain('offering x:dangling has missing model acme/missing');
    expect(errors).toContain('offering x:negative has a negative price');
    expect(errors).toContain('name x:name targets missing pointer nope');
  });

  it('warns about price outliers', async () => {
    let { catalog } = await buildCatalog({
      modelsDevPath: fixturePath,
      previousDir: null,
      offline: true,
      now,
      overrides: noOverrides
    });
    let base = catalog.offerings.find(item => item.modelId && item.pricing?.text?.input)!;
    let copies = [1, 1, 1, 100].map((factor, index) => ({
      ...base,
      id: `copy:${index}`,
      pricing: {
        ...base.pricing!,
        text: { ...base.pricing!.text!, input: base.pricing!.text!.input! * factor }
      }
    }));

    let { warnings } = validateCatalog({
      ...catalog,
      offerings: [...catalog.offerings, ...copies]
    });
    expect(warnings.some(warning => warning.startsWith('offering copy:3 input price'))).toBe(
      true
    );
  });
});
