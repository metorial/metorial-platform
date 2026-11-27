import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useAgentTrackingIngestSources,
  useAgentTrackingOrganizationSettings,
  useAgentTrackingSessions,
  useAgentTrackingSetupStatus
} from '@metorial/state';
import {
  Badge,
  Button,
  Callout,
  Copy,
  Flex,
  OptionToggle,
  RenderDate,
  Text,
  theme,
  Tooltip
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNow } from '@metorial/use-now';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useInterval, useToggle } from 'react-use';
import styled from 'styled-components';
import { useInstanceContext } from '../../lib/dataList';
import { useAgentTrackingAvailability } from './access';
import { formatDateTime, formatTime } from './activity';
import { ChecklistStep } from './checklist';
import { buildCodexConfig, codexConfigPath } from './codexConfig';
import {
  agentTrackingErrorStatus,
  AgentTrackingErrorState,
  noIngestAddressText,
  notSetUpText
} from './errorState';
import { WithInfo } from './info';
import {
  IngestSourcesTable,
  showCreateIngestSourceDialog,
  type CreatedIngestSource
} from './keys';
import { useAgentTrackingIndividualsVisibility } from './privacy';
import { useSearchParamOption } from './searchParams';
import { clientVersion } from './sessionParts';
import {
  buildClaudeCodeManagedSettings,
  defaultClaudeCodeSettingsOptions,
  managedSettingsFileName,
  otlpLogsEndpoint,
  withOrganizationReporting,
  type ClaudeCodeSettingsOptions
} from './settingsFile';
import { CodexConfigInstructions, CodexRestartInstructions } from './setupCodex';
import { DeployInstructions } from './setupDeploy';
import { clientLabel, memberName, modelLabel } from './spendSummary';

let firstEventPollMs = 10 * 1000;

let setupClients = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'other', label: 'Other Tools' }
] as const;

type SetupClient = (typeof setupClients)[number]['id'];

let setupClientIds = setupClients.map(client => client.id);

let List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding-left: 18px;
  color: ${theme.colors.gray800};
  font-size: 14px;
  line-height: 1.5;
`;

let Inset = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: ${theme.colors.gray100};
`;

let NotConfigured = () => (
  <Callout color="gray">
    {notSetUpText} No key can be created until Metorial enables it.
  </Callout>
);

let LatestSessionSummary = ({
  instanceId,
  arrivedNow
}: {
  instanceId: string;
  arrivedNow: boolean;
}) => {
  let sessions = useAgentTrackingSessions(instanceId, { limit: 1 });
  let now = useNow();

  return renderWithLoader(
    { sessions },
    {
      error: () => <>Open Sessions to see who it came from.</>
    }
  )(({ sessions }) => {
    let session = sessions.data.items[0];
    if (!session) return null;

    let who = memberName(session.member);
    let client = [clientLabel(session.client), clientVersion(session.client)]
      .filter(Boolean)
      .join(' ');
    let models = session.models.map(modelLabel).join(', ');
    let settling = session.summaryPending;

    return (
      <>
        {arrivedNow ? 'First session ' : 'Latest session '}
        {arrivedNow
          ? formatTime(session.startedAt)
          : formatDateTime(session.startedAt, now)}{' '}
        from <strong>{who}</strong> · {client}
        {models ? ` · ${models}` : ''}.
        {settling ? ' Its cost is settling and shows within 90 seconds.' : ''}
      </>
    );
  });
};

let OpenLatestSession = ({ instanceId }: { instanceId: string }) => {
  let ctx = useInstanceContext();
  let sessions = useAgentTrackingSessions(instanceId, { limit: 1 });
  let session = sessions.data?.items[0];

  if (!session) return null;

  return (
    <Link
      to={Paths.instance.agentTracking.session(
        ctx.organization,
        ctx.project,
        ctx.instance,
        session.id
      )}
    >
      <Button size="2" variant="outline" as="span">
        Open Session
      </Button>
    </Link>
  );
};

let WaitingForFirstEvent = ({
  listeningSince,
  hint,
  troubleshooting
}: {
  listeningSince: Date;
  hint: string;
  troubleshooting: ReactNode;
}) => {
  let [showTroubleshooting, toggleTroubleshooting] = useToggle(false);

  return (
    <Inset>
      <Flex align="center" gap={10} wrap="wrap">
        <Badge variant="connection" tone="available" loading>
          Waiting for the first event
        </Badge>
        <Text size="1" color="gray600">
          Listening since <RenderDate date={listeningSince} format="time" /> · this updates by
          itself
        </Text>
      </Flex>

      <Text size="2" color="gray700">
        {hint}
      </Text>

      <div>
        <Button size="1" variant="ghost" onClick={toggleTroubleshooting}>
          {showTroubleshooting ? 'Hide Troubleshooting' : 'Nothing After 5 Minutes?'}
        </Button>
      </div>

      {showTroubleshooting ? <List as="ol">{troubleshooting}</List> : null}
    </Inset>
  );
};

let ReachabilityStep = ({ logsEndpoint }: { logsEndpoint: string | null }) =>
  logsEndpoint ? (
    <li>
      Check that the machine can reach <code>{logsEndpoint}</code>, for example through a proxy
      or firewall.
    </li>
  ) : null;

let ClaudeCodeTroubleshooting = ({ logsEndpoint }: { logsEndpoint: string | null }) => (
  <>
    <li>
      Run the check command from step 2. No output means the file is not where Claude Code
      looks.
    </li>
    <li>
      Start a new Claude Code session on that machine. Sessions started after the file is in
      place report their usage.
    </li>
    <ReachabilityStep logsEndpoint={logsEndpoint} />
    <li>
      If the Claude admin console or an MDM profile already delivers managed settings, this
      file is ignored. See the note in step 2.
    </li>
  </>
);

let CodexTroubleshooting = ({ logsEndpoint }: { logsEndpoint: string | null }) => (
  <>
    <li>
      Check that <code>{codexConfigPath}</code> has one <code>[otel]</code> table with the{' '}
      <code>exporter</code> line in it. Codex ignores <code>[otel]</code> in a project's{' '}
      <code>.codex/config.toml</code>.
    </li>
    <li>
      Run the restart command from step 3 again, then send a prompt in Codex on that machine.
    </li>
    <ReachabilityStep logsEndpoint={logsEndpoint} />
  </>
);

let OtherTools = () => (
  <Box title="Other Tools">
    <Flex direction="column" gap={8}>
      <Text size="2" color="gray700">
        Cursor, OpenCode and Antigravity report usage only through Metorial Desktop, which sets
        them up on each member's computer. There is nothing to configure for them here.
      </Text>
      <Text size="2" color="gray700">
        Metorial Desktop also reports the repository, branch, commits and pull requests of
        sessions, for every tool including Claude Code and Codex.
      </Text>
    </Flex>
  </Box>
);

let CreateKeyButton = ({
  canWrite,
  notConfigured,
  ingestConfigured,
  secondary,
  onClick
}: {
  canWrite: boolean;
  notConfigured: boolean;
  ingestConfigured: boolean;
  secondary: boolean;
  onClick: () => void;
}) => {
  let reason = !canWrite
    ? 'Creating keys needs the Agent Usage write permission, which organization admins have.'
    : notConfigured
      ? notSetUpText
      : !ingestConfigured
        ? noIngestAddressText
        : undefined;

  return (
    <Tooltip content={reason} enabled={!!reason} delayDuration={0}>
      <div style={{ display: 'inline-flex' }}>
        <Button
          size="2"
          variant={secondary ? 'outline' : undefined}
          disabled={!!reason}
          onClick={onClick}
        >
          Create Key
        </Button>
      </div>
    </Tooltip>
  );
};

export let AgentTrackingSetup = ({ instanceId }: { instanceId: string }) => {
  let ctx = useInstanceContext();
  let { canWrite } = useAgentTrackingAvailability();
  let [client, setClient] = useSearchParamOption<SetupClient>(
    'client',
    setupClientIds,
    'claude-code'
  );
  let keys = useAgentTrackingIngestSources(instanceId, {
    status: ['active', 'revoked'],
    order: 'desc',
    limit: 10
  });
  let activeKeys = useAgentTrackingIngestSources(instanceId, { limit: 1, status: 'active' });
  let setupStatus = useAgentTrackingSetupStatus(instanceId);
  let notConfigured = [setupStatus.error, keys.error, activeKeys.error].some(
    error => agentTrackingErrorStatus(error) == 404
  );

  let [created, setCreated] = useState<CreatedIngestSource | null>(null);
  let organizationSettings = useAgentTrackingOrganizationSettings(ctx.organization?.id);
  let [chosenOptions, setOptions] = useState<ClaudeCodeSettingsOptions | null>(null);
  let organizationReporting = organizationSettings.data?.desktop;
  let options = useMemo(
    () =>
      withOrganizationReporting(
        chosenOptions ?? defaultClaudeCodeSettingsOptions(organizationReporting),
        organizationReporting
      ),
    [chosenOptions, organizationReporting]
  );
  let [showKeys, toggleKeys] = useToggle(false);
  let [showDeploy, setShowDeploy] = useState<boolean | null>(null);
  let { visibility } = useAgentTrackingIndividualsVisibility();
  let individualsHidden = visibility != 'visible';
  let [listeningSince] = useState(() => new Date());
  let hadDataOnArrival = useRef<boolean | null>(null);

  if (hadDataOnArrival.current === null && setupStatus.data) {
    hadDataOnArrival.current = !!setupStatus.data.lastReceivedAt;
  }

  let activeKey = activeKeys.data?.items[0];
  let ingestUrl = created?.ingestUrl ?? activeKey?.ingestUrl ?? null;
  let anyKey = activeKey ?? keys.data?.items[0];
  let ingestConfigured = !!created?.ingestUrl || !anyKey || !!anyKey.ingestUrl;
  let logsEndpoint = ingestUrl ? otlpLogsEndpoint(ingestUrl) : null;

  let hasKey = !!created || !!activeKey;
  let hasData = !!setupStatus.data?.lastReceivedAt;
  let arrivedNow = hadDataOnArrival.current === false && hasData;
  let waiting = !notConfigured && hasKey && !!setupStatus.data && !hasData;
  let deployShown = showDeploy ?? hadDataOnArrival.current !== true;

  useInterval(
    () => setupStatus.refetch(),
    waiting && client != 'other' ? firstEventPollMs : null
  );

  let file = useMemo(
    () =>
      ingestUrl
        ? buildClaudeCodeManagedSettings({
            ingestUrl,
            secret: created?.secret ?? null,
            options
          })
        : null,
    [ingestUrl, created?.secret, options]
  );

  let codexConfig = useMemo(
    () =>
      ingestUrl ? buildCodexConfig({ ingestUrl, secret: created?.secret ?? null }) : null,
    [ingestUrl, created?.secret]
  );

  let createKey = () =>
    showCreateIngestSourceDialog({
      instanceId,
      onCreate: ingestSource => {
        setCreated(ingestSource);
        setShowDeploy(true);
      }
    });

  let renderKeyStep = (subject: { short: string; full: string }) => (
    <ChecklistStep
      number={1}
      state={hasKey ? 'done' : 'current'}
      title="Create an Ingestion Key"
      description={
        created
          ? `${created.name} is filled into the ${subject.short} below.`
          : activeKey
            ? `${activeKey.name} is active; create a new key to get a ${subject.short} with the key filled in.`
            : `The ${subject.full} is built from it.`
      }
      action={
        <>
          <Button size="2" variant="ghost" onClick={toggleKeys}>
            {showKeys ? 'Hide Keys' : 'Manage Keys'}
          </Button>
          <CreateKeyButton
            canWrite={canWrite}
            notConfigured={notConfigured}
            ingestConfigured={ingestConfigured}
            secondary={hasKey}
            onClick={createKey}
          />
        </>
      }
    >
      {created?.secret || showKeys ? (
        <Flex direction="column" gap={12}>
          {created?.secret ? (
            <>
              <Callout color="orange">
                <strong>Copy the key now:</strong> it is shown only once, and the{' '}
                {subject.short} below already contains it.
              </Callout>
              <Copy label={`Ingestion Key: ${created.name}`} value={created.secret} />
            </>
          ) : null}

          {showKeys ? (
            notConfigured ? (
              <Text size="2" color="gray600">
                No ingestion keys yet.
              </Text>
            ) : (
              <IngestSourcesTable
                instanceId={instanceId}
                keys={keys}
                canWrite={canWrite}
                onRevoked={revokedId =>
                  setCreated(current => (current?.id == revokedId ? null : current))
                }
              />
            )
          ) : null}
        </Flex>
      ) : undefined}
    </ChecklistStep>
  );

  let renderFirstSessionStep = (d: {
    number: number;
    pendingText: string;
    waitingHint: string;
    troubleshooting: ReactNode;
    dataNote?: string;
  }) => (
    <ChecklistStep
      number={d.number}
      state={hasData ? 'done' : waiting ? 'current' : 'pending'}
      title={
        hasData
          ? arrivedNow
            ? 'First Session Arrived'
            : 'Data Is Arriving'
          : 'First Session Arrives'
      }
      description={
        hasData ? (
          <>
            {arrivedNow ? null : (
              <>
                Last event <RenderDate date={setupStatus.data!.lastReceivedAt!} />.{' '}
              </>
            )}
            {individualsHidden ? null : (
              <LatestSessionSummary instanceId={instanceId} arrivedNow={arrivedNow} />
            )}
            {d.dataNote ? <> {d.dataNote}</> : null}
          </>
        ) : waiting ? undefined : (
          d.pendingText
        )
      }
      action={
        hasData && !individualsHidden ? (
          <OpenLatestSession instanceId={instanceId} />
        ) : undefined
      }
    >
      {hasData ? undefined : setupStatus.error && !notConfigured ? (
        <AgentTrackingErrorState error={setupStatus.error} onRetry={setupStatus.refetch} />
      ) : waiting ? (
        <WaitingForFirstEvent
          listeningSince={listeningSince}
          hint={d.waitingHint}
          troubleshooting={d.troubleshooting}
        />
      ) : undefined}
    </ChecklistStep>
  );

  let renderMembersStep = (d: { number: number; matchInfo: string }) => (
    <ChecklistStep
      number={d.number}
      state={hasData ? 'done' : 'pending'}
      title={
        <WithInfo info={visibility == 'hidden' ? null : d.matchInfo}>Members Seen</WithInfo>
      }
      description={
        visibility == 'hidden'
          ? 'This organization hides individual data, so members are not listed; an organization admin can change this in the Agent Usage settings.'
          : undefined
      }
      action={
        individualsHidden || notConfigured ? undefined : (
          <Link
            to={Paths.instance.agentTracking.team(ctx.organization, ctx.project, ctx.instance)}
          >
            <Button size="2" variant="outline" as="span">
              Review Members
            </Button>
          </Link>
        )
      }
    />
  );

  return (
    <Flex direction="column" gap={20}>
      {notConfigured ? <NotConfigured /> : null}

      <div>
        <OptionToggle
          size="2"
          ariaLabel="Tool"
          items={setupClients.map(item => ({ id: item.id, label: item.label }))}
          value={client}
          onChange={value => setClient(value as SetupClient)}
        />
      </div>

      {client == 'claude-code' ? (
        <Box
          title={
            <WithInfo info="For Claude Code in the terminal and IDE extensions, with nothing to install.">
              Connect Claude Code
            </WithInfo>
          }
        >
          {renderKeyStep({ short: 'file', full: 'settings file' })}

          <ChecklistStep
            number={2}
            state={hasData ? 'done' : hasKey ? 'current' : 'pending'}
            title={`Deploy ${managedSettingsFileName}`}
            description="Put one file on every machine that runs Claude Code."
            action={
              <Button size="2" variant="ghost" onClick={() => setShowDeploy(!deployShown)}>
                {deployShown ? 'Hide Instructions' : 'Show Instructions'}
              </Button>
            }
          >
            {deployShown ? (
              <DeployInstructions
                instanceId={instanceId}
                file={file}
                notConfigured={notConfigured}
                options={options}
                organization={organizationReporting}
                onOptionsChange={setOptions}
              />
            ) : undefined}
          </ChecklistStep>

          {renderFirstSessionStep({
            number: 3,
            pendingText: 'Once the file is deployed, start Claude Code and send any prompt.',
            waitingHint:
              'Send any prompt in Claude Code on a machine with the file; the session shows up within a minute.',
            troubleshooting: <ClaudeCodeTroubleshooting logsEndpoint={logsEndpoint} />
          })}

          {renderMembersStep({
            number: 4,
            matchInfo:
              'Sessions are matched to members by the email of their Claude account, which a shared key does not verify.'
          })}
        </Box>
      ) : client == 'codex' ? (
        <Box
          title={
            <WithInfo info="Codex reads the exporter from its own config file, so there is nothing to install.">
              Connect Codex
            </WithInfo>
          }
        >
          {renderKeyStep({ short: 'config', full: 'Codex config' })}

          <ChecklistStep
            number={2}
            state={hasKey ? 'current' : 'pending'}
            title="Add the Exporter to config.toml"
            description={
              <>
                Add this to <code>{codexConfigPath}</code> on every machine that runs Codex.
              </>
            }
          >
            <CodexConfigInstructions
              instanceId={instanceId}
              config={codexConfig}
              notConfigured={notConfigured}
            />
          </ChecklistStep>

          <ChecklistStep
            number={3}
            state={hasKey ? 'current' : 'pending'}
            title="Restart Codex's Background Service"
            description="Interactive Codex runs in a background service that reads this setting only when it starts, so without a restart Codex keeps sending nothing."
          >
            <CodexRestartInstructions />
          </ChecklistStep>

          {renderFirstSessionStep({
            number: 4,
            pendingText: 'Once Codex has restarted, send any prompt in Codex.',
            waitingHint:
              'Send any prompt in Codex on a machine with the config; the session shows up within a minute.',
            troubleshooting: <CodexTroubleshooting logsEndpoint={logsEndpoint} />,
            dataNote: 'This counts data from every tool, not only Codex.'
          })}

          {renderMembersStep({
            number: 5,
            matchInfo:
              'Sessions are matched to members by the email of their ChatGPT account, which a shared key does not verify. Codex signed in with an API key sends no email.'
          })}
        </Box>
      ) : (
        <OtherTools />
      )}
    </Flex>
  );
};
