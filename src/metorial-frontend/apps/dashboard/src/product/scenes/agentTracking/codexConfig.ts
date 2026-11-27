import { otlpLogsEndpoint, ingestionKeyPlaceholder } from './settingsFile';

export let codexConfigPath = '~/.codex/config.toml';

export let codexRestartCommand = 'codex app-server daemon restart';

let tomlEscapes: Record<string, string> = {
  '"': '\\"',
  '\\': '\\\\',
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\f': '\\f',
  '\r': '\\r'
};

export let tomlBasicString = (value: string) =>
  `"${value.replace(
    /["\\\u0000-\u001f\u007f]/g,
    char =>
      tomlEscapes[char] ??
      `\\u${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`
  )}"`;

export let buildCodexConfig = (d: {
  ingestUrl: string;
  secret: string | null | undefined;
}) => {
  let endpoint = otlpLogsEndpoint(d.ingestUrl);
  let authorization = `Bearer ${d.secret || ingestionKeyPlaceholder}`;
  let exporterLine = `exporter = { otlp-http = { endpoint = ${tomlBasicString(endpoint)}, protocol = "json", headers = { Authorization = ${tomlBasicString(authorization)} } } }`;

  return {
    endpoint,
    exporterLine,
    toml: `[otel]\n${exporterLine}\n`,
    usesPlaceholder: !d.secret
  };
};
