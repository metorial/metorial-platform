export let mapProviderConfigPatchInput = (d: {
  configPatch?: { set?: Record<string, unknown>; remove?: string[] };
  expectedConfigGeneration?: number;
}) => ({
  configPatch: d.configPatch,
  expectedConfigGeneration: d.expectedConfigGeneration
});
