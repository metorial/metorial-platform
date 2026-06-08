import type { SkillConfiguration } from '@metorial-cargo/db';

export let intersectStringArrays = (arrays: string[][]): string[] => {
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return arrays[0]!;

  let [first, ...rest] = arrays;
  let restSets = rest.map(array => new Set(array));

  return first!.filter(item => restSets.every(set => set.has(item)));
};

export let intersectBooleans = (values: boolean[]) => values.every(v => v);

export let combineConfigs = (
  configs: (SkillConfiguration | undefined | null)[],
  defaultConfig: SkillConfiguration | null | undefined
) => {
  let producedConfigs = configs.filter((c): c is SkillConfiguration => !!c);

  if (!producedConfigs.length && defaultConfig) return defaultConfig;

  if (!producedConfigs.length) {
    return {
      allowScripts: true,
      allowedFileExtensions: [],
      allowNonStandardDirectories: true
    };
  }

  return {
    allowScripts: intersectBooleans(producedConfigs.map(c => c.allowScripts)),
    allowedFileExtensions: intersectStringArrays(
      producedConfigs.map(c => c.allowedFileExtensions)
    ),
    allowNonStandardDirectories: intersectBooleans(
      producedConfigs.map(c => c.allowNonStandardDirectories)
    )
  };
};
