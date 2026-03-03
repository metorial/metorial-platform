export type ConfigurationSelection =
  | { kind: 'none' }
  | { kind: 'config'; id: string }
  | { kind: 'vault'; id: string };

export let emptyConfigurationSelection = (): ConfigurationSelection => ({
  kind: 'none'
});

export let encodeConfigurationSelection = (
  selection: ConfigurationSelection
): string => {
  if (selection.kind === 'none') return '__none__';
  return `${selection.kind}:${selection.id}`;
};

export let decodeConfigurationSelection = (
  value: string | null | undefined
): ConfigurationSelection => {
  if (!value || value === '__none__') return emptyConfigurationSelection();

  if (value.startsWith('config:')) {
    return { kind: 'config', id: value.slice('config:'.length) };
  }

  if (value.startsWith('vault:')) {
    return { kind: 'vault', id: value.slice('vault:'.length) };
  }

  return emptyConfigurationSelection();
};
