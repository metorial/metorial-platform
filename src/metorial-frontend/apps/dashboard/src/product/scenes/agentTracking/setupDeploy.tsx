import { CodeBlock } from '@metorial/code';
import type { DashboardInstanceAgentTrackingSetupStatusGetOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { saveBlob } from '@metorial/file-browser';
import { useAgentTrackingIngestSources, useAgentTrackingSetupStatus } from '@metorial/state';
import {
  Badge,
  Button,
  Callout,
  Flex,
  OptionToggle,
  Spacer,
  Switch,
  Text,
  theme,
  Tooltip,
  useCopy
} from '@metorial/ui';
import { SideBox, Table } from '@metorial/ui-product';
import { RiDownloadLine, RiFileCopyLine } from '@remixicon/react';
import { useMemo, useState, type ReactNode } from 'react';
import { useToggle } from 'react-use';
import styled from 'styled-components';
import {
  agentTrackingErrorStatus,
  AgentTrackingErrorState,
  noIngestAddressText
} from './errorState';
import { WithInfo } from './info';
import {
  buildClaudeCodeManagedSettings,
  buildManagedSettingsCommands,
  detectManagedSettingsOs,
  ingestionKeyPlaceholder,
  localHistoryDays,
  managedSettingsFileName,
  managedSettingsLocations,
  type ClaudeCodeSettingsOptions,
  type ManagedSettingsOs
} from './settingsFile';

let templateFileName = 'managed-settings.TEMPLATE.json';

type OptionStatus = DashboardInstanceAgentTrackingSetupStatusGetOutput['options'];

type ManagedSettingsFile = ReturnType<typeof buildClaudeCodeManagedSettings>;

type DeployMode = 'machine' | 'mdm' | 'console';

type OptionDescriptor = {
  id: keyof OptionStatus;
  setting?: keyof ClaudeCodeSettingsOptions;
  label: string;
  sends: string;
  unlocks: string;
  note?: string;
  availability: 'always' | 'choice' | 'later';
};

let optionDescriptors: OptionDescriptor[] = [
  {
    id: 'usageAndCost',
    label: 'Usage and Cost',
    sends:
      'Each model request with its model, tokens and the cost Claude Code computes, and the length of prompts and responses, tool calls, permission decisions, hook runs and MCP connections, without their text.',
    unlocks: 'Spend and Sessions.',
    availability: 'always'
  },
  {
    id: 'keepLocalHistory',
    setting: 'keepLocalHistory',
    label: 'Keep Local History',
    sends: `Nothing. It sets how long Claude Code keeps local session history on every machine that gets this file: ${localHistoryDays} days.`,
    unlocks: 'Importing past sessions in a later release, which needs that history.',
    note: `It overrides each member's own setting, including a longer one: a member who keeps more than ${localHistoryDays} days loses the older history at Claude Code's next cleanup.`,
    availability: 'choice'
  },
  {
    id: 'repository',
    setting: 'repository',
    label: 'Repository',
    sends: 'The repository of each session, taken from its git remote.',
    unlocks: 'Spend by repository, in a later release.',
    availability: 'choice'
  },
  {
    id: 'toolDetails',
    setting: 'toolDetails',
    label: 'Detailed Tool Reporting',
    sends:
      'Skill, MCP, agent and plugin names, the branch of commits and the error text of failed tools. With them, Claude Code also sends tool inputs, file paths and commands off the device.',
    unlocks:
      'Skill and MCP server usage on the Tools tab, and spend by branch in a later release.',
    note: 'Off by default because it sends tool inputs, file paths and commands. Agent Usage keeps only the length and a keyed hash of each tool input and error text, never the text itself.',
    availability: 'choice'
  },
  {
    id: 'hooks',
    label: 'Hooks',
    sends: 'Session titles, tool calls and failures.',
    unlocks: 'Session detail.',
    note: 'Not available yet. It arrives in a later release with its own setup.',
    availability: 'later'
  }
];

let detectionBadges = {
  detected: { label: 'Seen in Data', color: 'green', hint: 'Incoming data proves it is on.' },
  not_detected: {
    label: 'Not Seen Yet',
    color: 'gray',
    hint: 'No data of the last 30 days proves it is on. It is off, or not used yet.'
  },
  undetectable: {
    label: 'Cannot Be Confirmed',
    color: 'gray',
    hint: 'Metorial cannot confirm this option from incoming data yet.'
  }
} as const;

let osInstructions: Record<ManagedSettingsOs, string> = {
  macos: 'Run this in Terminal; it asks for your Mac password and writes the file.',
  linux: 'Run this in a terminal, on WSL inside the Linux distribution; it writes the file.',
  windows: 'Run this in PowerShell opened with Run as Administrator; it writes the file.'
};

let OptionRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 14px 0;

  &:not(:last-child) {
    border-bottom: 1px solid ${theme.colors.gray300};
  }
`;

let HintBadge = ({
  label,
  color,
  hint
}: {
  label: ReactNode;
  color: 'green' | 'gray';
  hint: ReactNode;
}) => (
  <Tooltip content={hint}>
    <span>
      <Badge size="2" color={color}>
        {label}
      </Badge>
    </span>
  </Tooltip>
);

let CopyButton = ({
  value,
  label,
  variant = 'outline'
}: {
  value: string;
  label: string;
  variant?: 'outline' | 'ghost';
}) => {
  let { copy, copied } = useCopy(value);

  return (
    <Button size="1" variant={variant} iconLeft={<RiFileCopyLine />} onClick={() => copy()}>
      {copied ? 'Copied' : label}
    </Button>
  );
};

let SettingsOptions = ({
  instanceId,
  options,
  onChange
}: {
  instanceId: string;
  options: ClaudeCodeSettingsOptions;
  onChange: (options: ClaudeCodeSettingsOptions) => void;
}) => {
  let setupStatus = useAgentTrackingSetupStatus(instanceId);

  return (
    <div>
      <Text size="2" color="gray700">
        Changing these later means deploying the file again.
      </Text>

      {setupStatus.error && agentTrackingErrorStatus(setupStatus.error) != 404 ? (
        <>
          <Spacer height={8} />
          <Text size="1" color="gray600">
            Which options incoming data proves are on cannot be checked right now.
          </Text>
        </>
      ) : null}

      {optionDescriptors.map(option => (
        <OptionRow key={option.id}>
          <Flex direction="column" gap={4} style={{ minWidth: 0 }}>
            <WithInfo info={option.note}>
              <Text size="2" weight="strong">
                {option.label}
              </Text>
            </WithInfo>
            <Text size="2" color="gray700">
              Sends: {option.sends}
            </Text>
            <Text size="2" color="gray700">
              Unlocks: {option.unlocks}
            </Text>
          </Flex>

          <Flex align="center" gap={12} style={{ flexShrink: 0 }}>
            {setupStatus.data && option.availability != 'later' ? (
              <HintBadge {...detectionBadges[setupStatus.data.options[option.id]]} />
            ) : null}

            <Switch
              label={option.label}
              hideLabel
              checked={
                option.setting ? options[option.setting] : option.availability == 'always'
              }
              disabled={!option.setting}
              onCheckedChange={checked =>
                option.setting && onChange({ ...options, [option.setting]: checked })
              }
            />
          </Flex>
        </OptionRow>
      ))}
    </div>
  );
};

let CommandStep = ({
  title,
  command,
  language
}: {
  title: string;
  command: string;
  language: string;
}) => (
  <>
    <Text size="2" weight="medium">
      {title}
    </Text>
    <CodeBlock code={command} language={language} lineNumbers={false} />
    <div>
      <CopyButton value={command} label="Copy Command" />
    </div>
  </>
);

let MissingFile = ({
  instanceId,
  notConfigured
}: {
  instanceId: string;
  notConfigured: boolean;
}) => {
  let activeKeys = useAgentTrackingIngestSources(instanceId, { limit: 1, status: 'active' });

  if (notConfigured) {
    return (
      <Text size="2" color="gray600">
        The file is built from an ingestion key.
      </Text>
    );
  }

  return renderWithLoader(
    { activeKeys },
    { error: error => <AgentTrackingErrorState error={error} onRetry={activeKeys.refetch} /> }
  )(({ activeKeys }) =>
    activeKeys.data.items.length ? (
      <Callout color="gray">
        {noIngestAddressText} No file can be built, but existing keys can still be revoked.
      </Callout>
    ) : (
      <Text size="2" color="gray600">
        Create an ingestion key first. The file is built from it.
      </Text>
    )
  );
};

let optionsSummary = (options: ClaudeCodeSettingsOptions) => {
  let choices = optionDescriptors.filter(option => option.setting);
  let on = [
    'Usage and Cost',
    ...choices.filter(option => options[option.setting!]).map(option => option.label)
  ];
  let off = choices.filter(option => !options[option.setting!]).map(option => option.label);

  return `${on.join(', ')}.${off.length ? ` ${off.join(', ')} off.` : ''}`;
};

let FileActions = ({ file }: { file: ManagedSettingsFile }) => {
  let { copy, copied } = useCopy(file.json);

  return (
    <Flex gap={8}>
      <Button
        size="2"
        iconLeft={<RiDownloadLine />}
        onClick={() =>
          saveBlob(
            new Blob([file.json], { type: 'application/json' }),
            file.usesPlaceholder ? templateFileName : managedSettingsFileName
          )
        }
      >
        {file.usesPlaceholder
          ? 'Download Template (Key Missing)'
          : `Download ${managedSettingsFileName}`}
      </Button>
      <Button size="2" variant="outline" iconLeft={<RiFileCopyLine />} onClick={() => copy()}>
        {copied
          ? 'Copied'
          : file.usesPlaceholder
            ? 'Copy Template (Key Missing)'
            : 'Copy File'}
      </Button>
    </Flex>
  );
};

let TemplateNotice = () => (
  <Callout color="orange">
    Replace <code>{ingestionKeyPlaceholder}</code> in this template with the key you saved, or
    create a new key to get a complete file.
  </Callout>
);

let ThisMachine = ({ file }: { file: ManagedSettingsFile }) => {
  let [os, setOs] = useState<ManagedSettingsOs>(() =>
    detectManagedSettingsOs(
      typeof navigator == 'undefined' ? null : `${navigator.platform} ${navigator.userAgent}`
    )
  );
  let commands = useMemo(
    () => buildManagedSettingsCommands({ os, json: file.json }),
    [os, file.json]
  );
  let location = managedSettingsLocations.find(location => location.id == os)!;
  let language = os == 'windows' ? 'powershell' : 'bash';

  return (
    <Flex direction="column" gap={8}>
      <Flex align="center" gap={12} wrap="wrap">
        <OptionToggle
          ariaLabel="Operating system"
          size="1"
          value={os}
          onChange={value => setOs(value as ManagedSettingsOs)}
          items={managedSettingsLocations.map(location => ({
            id: location.id,
            label: location.os
          }))}
        />
      </Flex>

      {file.usesPlaceholder ? (
        <>
          <TemplateNotice />
          <Text size="2" color="gray700">
            Then place the file at <code>{location.path}</code>.
          </Text>
        </>
      ) : (
        <>
          <CommandStep
            title={`1. ${osInstructions[os]}`}
            command={commands.install}
            language={language}
          />

          <Spacer height={4} />

          <CommandStep
            title="2. Check it. This should print the ingest address."
            command={commands.check}
            language={language}
          />

          {os == 'macos' ? (
            <Text size="2" color="gray700">
              Claude Code reads <code>{managedSettingsFileName}</code> only from this system
              folder, not from <code>~/.claude</code>.
            </Text>
          ) : null}

          <Spacer height={4} />

          <Text size="2" weight="medium">
            3. Start a new Claude Code session and send a prompt.
          </Text>
        </>
      )}
    </Flex>
  );
};

let ManyMachines = ({ file }: { file: ManagedSettingsFile | null }) => (
  <Flex direction="column" gap={8}>
    <Text size="2" color="gray700">
      Place the file at the path below with Jamf, Intune, Kandji or other device management.
    </Text>

    {file?.usesPlaceholder ? <TemplateNotice /> : null}

    <Table
      headers={['System', 'Path', '']}
      data={managedSettingsLocations.map(location => [
        <Text key="os" as="span" size="2" weight="medium">
          {location.os}
        </Text>,
        <code key="path">{location.path}</code>,
        <CopyButton key="copy" value={location.path} label="Copy Path" />
      ])}
    />
  </Flex>
);

let AdminConsole = ({ file }: { file: ManagedSettingsFile | null }) => (
  <Flex direction="column" gap={8}>
    <Text size="2" color="gray700">
      On Claude Team and Enterprise plans, paste the file's JSON into the managed settings of
      the Claude admin console.
    </Text>

    {file ? (
      <>
        {file.usesPlaceholder ? <TemplateNotice /> : null}
        <CodeBlock code={file.json} language="json" lineNumbers={false} />
      </>
    ) : null}
  </Flex>
);

let OtherSourcesNote = ({ file }: { file: ManagedSettingsFile | null }) => (
  <Callout
    color="gray"
    action={file ? <CopyButton value={file.envJson} label="Copy Env Block" /> : undefined}
  >
    If the Claude admin console or an MDM profile already delivers managed settings, Claude
    Code ignores this file: add its <code>env</code> block and <code>cleanupPeriodDays</code>{' '}
    to that source instead.
  </Callout>
);

export let DeployInstructions = ({
  instanceId,
  file,
  notConfigured,
  options,
  onOptionsChange
}: {
  instanceId: string;
  file: ManagedSettingsFile | null;
  notConfigured: boolean;
  options: ClaudeCodeSettingsOptions;
  onOptionsChange: (options: ClaudeCodeSettingsOptions) => void;
}) => {
  let [mode, setMode] = useState<DeployMode>('machine');
  let [showOptions, toggleOptions] = useToggle(false);

  return (
    <Flex direction="column" gap={16}>
      <Flex align="center" justify="space-between" gap={12} wrap="wrap">
        <OptionToggle
          ariaLabel="Where the file goes"
          size="2"
          value={mode}
          onChange={value => setMode(value as DeployMode)}
          items={[
            { id: 'machine', label: 'This Machine' },
            { id: 'mdm', label: 'Many Machines (MDM)' },
            { id: 'console', label: 'Claude Admin Console' }
          ]}
        />

        {file ? <FileActions file={file} /> : null}
      </Flex>

      {file ? null : <MissingFile instanceId={instanceId} notConfigured={notConfigured} />}

      {mode == 'machine' ? (
        file ? (
          <ThisMachine file={file} />
        ) : null
      ) : mode == 'mdm' ? (
        <ManyMachines file={file} />
      ) : (
        <AdminConsole file={file} />
      )}

      <OtherSourcesNote file={file} />

      <SideBox title="What Claude Code Sends" description={optionsSummary(options)}>
        <Button size="1" variant="ghost" onClick={toggleOptions}>
          {showOptions ? 'Hide Options' : 'Change'}
        </Button>
      </SideBox>

      {showOptions ? (
        <SettingsOptions
          instanceId={instanceId}
          options={options}
          onChange={onOptionsChange}
        />
      ) : null}
    </Flex>
  );
};
