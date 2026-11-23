import { describe, expect, it } from 'vitest';
import {
  buildClaudeCodeManagedSettings,
  buildManagedSettingsCommands,
  claudeCodeLogsEndpoint,
  defaultClaudeCodeSettingsOptions,
  detectManagedSettingsOs,
  ingestionKeyPlaceholder,
  managedSettingsLocations
} from './settingsFile';

let ingestUrl = 'https://agent-tracking-ingest.example.com';
let secret = 'metorial_atis_0mhNnEqM7XQb3vXq8gD2abcd';

describe('buildClaudeCodeManagedSettings', () => {
  it('exports only the logs signal over protobuf to the ingest logs path by default', () => {
    let file = buildClaudeCodeManagedSettings({
      ingestUrl,
      secret,
      options: defaultClaudeCodeSettingsOptions
    });

    expect(file.json).toBe(
      [
        '{',
        '  "env": {',
        '    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",',
        '    "OTEL_LOGS_EXPORTER": "otlp",',
        '    "OTEL_EXPORTER_OTLP_LOGS_PROTOCOL": "http/protobuf",',
        '    "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT": "https://agent-tracking-ingest.example.com/v1/logs",',
        `    "OTEL_EXPORTER_OTLP_LOGS_HEADERS": "Authorization=Bearer ${secret}",`,
        '    "OTEL_METRICS_INCLUDE_REPOSITORY": "true"',
        '  },',
        '  "cleanupPeriodDays": 365',
        '}',
        ''
      ].join('\n')
    );
    expect(file.usesPlaceholder).toBe(false);
  });

  it('adds tool details only when chosen', () => {
    let off = buildClaudeCodeManagedSettings({
      ingestUrl,
      secret,
      options: defaultClaudeCodeSettingsOptions
    });
    let on = buildClaudeCodeManagedSettings({
      ingestUrl,
      secret,
      options: { ...defaultClaudeCodeSettingsOptions, toolDetails: true }
    });

    expect(off.settings.env).not.toHaveProperty('OTEL_LOG_TOOL_DETAILS');
    expect(on.settings.env.OTEL_LOG_TOOL_DETAILS).toBe('1');
  });

  it('leaves out the repository and local history settings when they are off', () => {
    let file = buildClaudeCodeManagedSettings({
      ingestUrl,
      secret,
      options: { keepLocalHistory: false, repository: false, toolDetails: false }
    });

    expect(file.settings).toEqual({
      env: {
        CLAUDE_CODE_ENABLE_TELEMETRY: '1',
        OTEL_LOGS_EXPORTER: 'otlp',
        OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: 'http/protobuf',
        OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: `${ingestUrl}/v1/logs`,
        OTEL_EXPORTER_OTLP_LOGS_HEADERS: `Authorization=Bearer ${secret}`
      }
    });
  });

  it('never points metrics, traces or the shared exporter variables at ingest', () => {
    let file = buildClaudeCodeManagedSettings({
      ingestUrl,
      secret,
      options: { keepLocalHistory: true, repository: true, toolDetails: true }
    });

    for (let key of [
      'OTEL_METRICS_EXPORTER',
      'OTEL_TRACES_EXPORTER',
      'OTEL_EXPORTER_OTLP_ENDPOINT',
      'OTEL_EXPORTER_OTLP_PROTOCOL',
      'OTEL_EXPORTER_OTLP_HEADERS',
      'CLAUDE_CODE_ENHANCED_TELEMETRY_BETA',
      'OTEL_LOG_USER_PROMPTS'
    ]) {
      expect(file.settings.env).not.toHaveProperty(key);
    }

    expect(Object.values(file.settings.env).every(value => typeof value == 'string')).toBe(
      true
    );
  });

  it('writes a marked placeholder when the key is no longer available', () => {
    for (let missing of [null, undefined, '']) {
      let file = buildClaudeCodeManagedSettings({
        ingestUrl,
        secret: missing,
        options: defaultClaudeCodeSettingsOptions
      });

      expect(file.usesPlaceholder).toBe(true);
      expect(file.settings.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS).toBe(
        `Authorization=Bearer ${ingestionKeyPlaceholder}`
      );
    }
  });

  it('joins the logs path onto an ingest URL with trailing slashes', () => {
    let file = buildClaudeCodeManagedSettings({
      ingestUrl: ' https://ingest.example.com// ',
      secret,
      options: defaultClaudeCodeSettingsOptions
    });

    expect(file.settings.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT).toBe(
      'https://ingest.example.com/v1/logs'
    );
  });

  it('produces JSON that parses back to the same settings', () => {
    let file = buildClaudeCodeManagedSettings({
      ingestUrl,
      secret,
      options: { keepLocalHistory: true, repository: true, toolDetails: true }
    });

    expect(JSON.parse(file.json)).toEqual(file.settings);
  });
});

describe('managedSettingsLocations', () => {
  it('lists the system directory for each operating system', () => {
    expect(managedSettingsLocations.map(location => location.path)).toEqual([
      '/Library/Application Support/ClaudeCode/managed-settings.json',
      '/etc/claude-code/managed-settings.json',
      'C:\\Program Files\\ClaudeCode\\managed-settings.json'
    ]);
  });
});

describe('buildManagedSettingsCommands', () => {
  let file = buildClaudeCodeManagedSettings({
    ingestUrl,
    secret,
    options: defaultClaudeCodeSettingsOptions
  });

  it('creates the macOS folder and quotes the path with a space', () => {
    let commands = buildManagedSettingsCommands({ os: 'macos', json: file.json });
    let lines = commands.install.split('\n');

    expect(lines[0]).toBe('sudo mkdir -p "/Library/Application Support/ClaudeCode" &&');
    expect(lines[1]).toBe(
      `  sudo tee "/Library/Application Support/ClaudeCode/managed-settings.json" > /dev/null <<'METORIAL_SETTINGS'`
    );
    expect(lines.at(-1)).toBe('METORIAL_SETTINGS');
    expect(commands.check).toBe(
      'grep LOGS_ENDPOINT "/Library/Application Support/ClaudeCode/managed-settings.json"'
    );
  });

  it('creates the Linux folder with sudo before writing the file', () => {
    let commands = buildManagedSettingsCommands({ os: 'linux', json: file.json });

    expect(commands.install.startsWith('sudo mkdir -p "/etc/claude-code" &&\n')).toBe(true);
    expect(commands.install).toContain('sudo tee "/etc/claude-code/managed-settings.json"');
    expect(commands.check).toBe('grep LOGS_ENDPOINT "/etc/claude-code/managed-settings.json"');
  });

  it('creates the Windows folder and writes the file without a byte order mark', () => {
    let commands = buildManagedSettingsCommands({ os: 'windows', json: file.json });
    let lines = commands.install.split('\n');

    expect(lines[0]).toBe(
      "New-Item -ItemType Directory -Force -Path 'C:\\Program Files\\ClaudeCode' | Out-Null"
    );
    expect(lines[1]).toBe(
      "[System.IO.File]::WriteAllText('C:\\Program Files\\ClaudeCode\\managed-settings.json', @'"
    );
    expect(lines.at(-1)).toBe("'@)");
    expect(commands.install).not.toContain('Set-Content');
    expect(commands.check).toBe(
      "Select-String LOGS_ENDPOINT 'C:\\Program Files\\ClaudeCode\\managed-settings.json'"
    );
  });

  it.each(['macos', 'linux', 'windows'] as const)(
    'writes the whole file with the key filled in on %s',
    os => {
      let commands = buildManagedSettingsCommands({ os, json: file.json });
      let body = commands.install.split('\n').slice(2, -1).join('\n');

      expect(commands.install).toContain(`Authorization=Bearer ${secret}`);
      expect(commands.install).not.toContain(ingestionKeyPlaceholder);
      expect(JSON.parse(body)).toEqual(file.settings);
    }
  );

  it('points the check at the line that holds the ingest address', () => {
    let line = file.json.split('\n').find(line => line.includes('LOGS_ENDPOINT'));

    expect(line).toContain(claudeCodeLogsEndpoint(ingestUrl));
  });
});

describe('detectManagedSettingsOs', () => {
  it.each([
    ['MacIntel', 'macos'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Darwin', 'macos'],
    ['Win32', 'windows'],
    ['Linux x86_64', 'linux'],
    ['', 'macos'],
    [undefined, 'macos']
  ])('reads %s as %s', (platform, os) => {
    expect(detectManagedSettingsOs(platform)).toBe(os);
  });
});
