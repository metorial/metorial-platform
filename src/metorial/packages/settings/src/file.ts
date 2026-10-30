type ConfigFile = Record<string, any>;

let cache: { path: string; contents: ConfigFile } | null = null;

let parseConfigFile = (path: string, text: string): ConfigFile => {
  if (/\.ya?ml$/.test(path)) {
    let yaml = (globalThis as any).Bun?.YAML;

    if (!yaml) throw new Error(`YAML config files need the Bun runtime: ${path}`);

    return yaml.parse(text) ?? {};
  }

  return JSON.parse(text);
};

export let loadConfigFile = (): ConfigFile => {
  let path = process.env.METORIAL_CONFIG_FILE;
  if (!path) return {};

  if (cache?.path == path) return cache.contents;

  let contents: ConfigFile;

  try {
    let fs = (process as any).getBuiltinModule?.('node:fs');
    if (!fs) throw new Error('reading config files needs a Node compatible runtime');

    contents = parseConfigFile(path, fs.readFileSync(path, 'utf8'));
  } catch (error: any) {
    throw new Error(
      `SETTINGS CONFIG FILE: could not read ${path} - ${error?.message ?? error}`
    );
  }

  cache = { path, contents };

  return contents;
};

export let readConfigFileValue = (file: ConfigFile, group: string, key: string) =>
  file?.[group]?.[key] ?? file?.[key];

export let resetConfigFileCache = () => {
  cache = null;
};
