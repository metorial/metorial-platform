export let ingestionKeyPlaceholder = 'PASTE_YOUR_INGESTION_KEY_HERE';

export let localHistoryDays = 365;

let settingsHeredocDelimiter = 'METORIAL_SETTINGS';

export type ClaudeCodeSettingsOptions = {
  keepLocalHistory: boolean;
  repository: boolean;
  toolDetails: boolean;
};

export let defaultClaudeCodeSettingsOptions: ClaudeCodeSettingsOptions = {
  keepLocalHistory: true,
  repository: true,
  toolDetails: false
};

export type OrganizationReporting = { toolDetails: boolean; sessionContext: boolean };

let organizationSwitchOf: Partial<
  Record<keyof ClaudeCodeSettingsOptions, keyof OrganizationReporting>
> = {
  repository: 'sessionContext',
  toolDetails: 'toolDetails'
};

export let isOffForOrganization = (
  setting: keyof ClaudeCodeSettingsOptions,
  organization: OrganizationReporting | null | undefined
) => {
  let organizationSwitch = organizationSwitchOf[setting];

  return !!organizationSwitch && organization?.[organizationSwitch] === false;
};

export let withOrganizationReporting = (
  options: ClaudeCodeSettingsOptions,
  organization: OrganizationReporting | null | undefined
): ClaudeCodeSettingsOptions => ({
  ...options,
  repository: options.repository && !isOffForOrganization('repository', organization),
  toolDetails: options.toolDetails && !isOffForOrganization('toolDetails', organization)
});

type ClaudeCodeManagedSettings = {
  env: Record<string, string>;
  cleanupPeriodDays?: number;
};

export let claudeCodeLogsEndpoint = (ingestUrl: string) =>
  `${ingestUrl.trim().replace(/\/+$/, '')}/v1/logs`;

// Only the logs signal goes to ingest, through per-signal variables, so metrics or traces
// exported elsewhere never receive the key.
export let buildClaudeCodeManagedSettings = (d: {
  ingestUrl: string;
  secret: string | null | undefined;
  options: ClaudeCodeSettingsOptions;
}) => {
  let env: Record<string, string> = {
    CLAUDE_CODE_ENABLE_TELEMETRY: '1',
    OTEL_LOGS_EXPORTER: 'otlp',
    OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: 'http/protobuf',
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: claudeCodeLogsEndpoint(d.ingestUrl),
    OTEL_EXPORTER_OTLP_LOGS_HEADERS: `Authorization=Bearer ${d.secret || ingestionKeyPlaceholder}`
  };

  if (d.options.repository) env.OTEL_METRICS_INCLUDE_REPOSITORY = 'true';
  if (d.options.toolDetails) env.OTEL_LOG_TOOL_DETAILS = '1';

  let settings: ClaudeCodeManagedSettings = {
    env,
    ...(d.options.keepLocalHistory ? { cleanupPeriodDays: localHistoryDays } : {})
  };

  return {
    settings,
    json: `${JSON.stringify(settings, null, 2)}\n`,
    envJson: `${JSON.stringify({ env }, null, 2)}\n`,
    usesPlaceholder: !d.secret
  };
};

export let managedSettingsFileName = 'managed-settings.json';

export type ManagedSettingsOs = 'macos' | 'linux' | 'windows';

export let managedSettingsLocations: {
  id: ManagedSettingsOs;
  os: string;
  directory: string;
  path: string;
}[] = [
  {
    id: 'macos',
    os: 'macOS',
    directory: '/Library/Application Support/ClaudeCode',
    path: '/Library/Application Support/ClaudeCode/managed-settings.json'
  },
  {
    id: 'linux',
    os: 'Linux and WSL',
    directory: '/etc/claude-code',
    path: '/etc/claude-code/managed-settings.json'
  },
  {
    id: 'windows',
    os: 'Windows',
    directory: 'C:\\Program Files\\ClaudeCode',
    path: 'C:\\Program Files\\ClaudeCode\\managed-settings.json'
  }
];

export let detectManagedSettingsOs = (
  platform: string | null | undefined
): ManagedSettingsOs => {
  let value = (platform ?? '').toLowerCase();

  if (value.includes('mac') || value.includes('iphone') || value.includes('ipad'))
    return 'macos';
  if (value.includes('win')) return 'windows';
  if (value.includes('linux') || value.includes('x11') || value.includes('cros'))
    return 'linux';
  return 'macos';
};

// One compound command with a here-document, so pasted lines are never read as the sudo
// password. WriteAllText, because Set-Content in Windows PowerShell 5.1 adds a BOM.
export let buildManagedSettingsCommands = (d: { os: ManagedSettingsOs; json: string }) => {
  let location = managedSettingsLocations.find(location => location.id == d.os)!;

  if (d.os == 'windows') {
    return {
      install: [
        `New-Item -ItemType Directory -Force -Path '${location.directory}' | Out-Null`,
        `[System.IO.File]::WriteAllText('${location.path}', @'`,
        `${d.json.replace(/\n$/, '')}`,
        `'@)`
      ].join('\n'),
      check: `Select-String LOGS_ENDPOINT '${location.path}'`
    };
  }

  return {
    install: [
      `sudo mkdir -p "${location.directory}" &&`,
      `  sudo tee "${location.path}" > /dev/null <<'${settingsHeredocDelimiter}'`,
      `${d.json}${settingsHeredocDelimiter}`
    ].join('\n'),
    check: `grep LOGS_ENDPOINT "${location.path}"`
  };
};
