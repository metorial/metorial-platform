import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useAgentTrackingIngestSources,
  useAgentTrackingSessions,
  useAgentTrackingSetupStatus
} from '@metorial/state';
import {
  Badge,
  Button,
  Callout,
  Copy,
  Flex,
  RenderDate,
  Text,
  theme,
  Tooltip
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNow } from '@metorial/use-now';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInterval, useToggle } from 'react-use';
import styled from 'styled-components';
import { useInstanceContext } from '../../lib/dataList';
import { useAgentTrackingWriteAccess } from './access';
import { formatDateTime, formatTime } from './activity';
import { ChecklistStep } from './checklist';
import {
  agentTrackingErrorStatus,
  AgentTrackingErrorState,
  noIngestAddressText,
  notSetUpText
} from './errorState';
import {
  IngestSourcesTable,
  showCreateIngestSourceDialog,
  type CreatedIngestSource
} from './keys';
import { memberName } from './memberParts';
import { useAgentTrackingPrivacy } from './privacy';
import { clientLabel, clientVersion, modelLabel } from './sessionParts';
import {
  buildClaudeCodeManagedSettings,
  claudeCodeLogsEndpoint,
  defaultClaudeCodeSettingsOptions,
  managedSettingsFileName
} from './settingsFile';
import { DeployInstructions } from './setupDeploy';

let firstEventPollMs = 10 * 1000;

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
  logsEndpoint
}: {
  listeningSince: Date;
  logsEndpoint: string | null;
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
        Send any prompt in Claude Code on a machine with the file; the session shows up within
        a minute.
      </Text>

      <div>
        <Button size="1" variant="ghost" onClick={toggleTroubleshooting}>
          {showTroubleshooting ? 'Hide Troubleshooting' : 'Nothing After 5 Minutes?'}
        </Button>
      </div>

      {showTroubleshooting ? (
        <List as="ol">
          <li>
            Run the check command from step 2. No output means the file is not where Claude
            Code looks.
          </li>
          <li>
            Start a new Claude Code session on that machine. Sessions started after the file is
            in place report their usage.
          </li>
          {logsEndpoint ? (
            <li>
              Check that the machine can reach <code>{logsEndpoint}</code>, for example through
              a proxy or firewall.
            </li>
          ) : null}
          <li>
            If the Claude admin console or an MDM profile already delivers managed settings,
            this file is ignored. See the note in step 2.
          </li>
        </List>
      ) : null}
    </Inset>
  );
};

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
  let canWrite = useAgentTrackingWriteAccess();
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
  let [options, setOptions] = useState(defaultClaudeCodeSettingsOptions);
  let [showKeys, toggleKeys] = useToggle(false);
  let [showDeploy, setShowDeploy] = useState<boolean | null>(null);
  let settings = useAgentTrackingPrivacy();
  let individualsHidden = settings.data?.privacy.hideIndividuals ?? true;
  let [listeningSince] = useState(() => new Date());
  let hadDataOnArrival = useRef<boolean | null>(null);

  if (hadDataOnArrival.current === null && setupStatus.data) {
    hadDataOnArrival.current = !!setupStatus.data.lastReceivedAt;
  }

  let activeKey = activeKeys.data?.items[0];
  let ingestUrl = created?.ingestUrl ?? activeKey?.ingestUrl ?? null;
  let anyKey = activeKey ?? keys.data?.items[0];
  let ingestConfigured = !!created?.ingestUrl || !anyKey || !!anyKey.ingestUrl;

  let hasKey = !!created || !!activeKey;
  let hasData = !!setupStatus.data?.lastReceivedAt;
  let arrivedNow = hadDataOnArrival.current === false && hasData;
  let waiting = !notConfigured && hasKey && !!setupStatus.data && !hasData;
  let deployShown = showDeploy ?? hadDataOnArrival.current !== true;

  useInterval(() => setupStatus.refetch(), waiting ? firstEventPollMs : null);

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

  let createKey = () =>
    showCreateIngestSourceDialog({
      instanceId,
      onCreate: ingestSource => {
        setCreated(ingestSource);
        setShowDeploy(true);
      }
    });

  let keyDescription = created
    ? `${created.name} is filled into the file below.`
    : activeKey
      ? `${activeKey.name} is active; create a new key to get a file with the key filled in.`
      : 'The settings file is built from it.';

  return (
    <Flex direction="column" gap={20}>
      {notConfigured ? <NotConfigured /> : null}

      <Box
        title="Connect Claude Code"
        description="For Claude Code in the terminal and IDE extensions, with nothing to install."
      >
        <ChecklistStep
          number={1}
          state={hasKey ? 'done' : 'current'}
          title="Create an Ingestion Key"
          description={keyDescription}
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
                    <strong>Copy the key now:</strong> it is shown only once, and the file
                    below already contains it.
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
              onOptionsChange={setOptions}
            />
          ) : undefined}
        </ChecklistStep>

        <ChecklistStep
          number={3}
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
              </>
            ) : waiting ? undefined : (
              'Once the file is deployed, start Claude Code and send any prompt.'
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
              logsEndpoint={ingestUrl ? claudeCodeLogsEndpoint(ingestUrl) : null}
            />
          ) : undefined}
        </ChecklistStep>

        <ChecklistStep
          number={4}
          state={hasData ? 'done' : 'pending'}
          title="Members Seen"
          description={
            individualsHidden && settings.data
              ? 'This organization hides individual data, so members are not listed; an organization admin can change this in Project Settings.'
              : 'Sessions are matched to members by the email of their Claude account, which a shared key does not verify.'
          }
          action={
            individualsHidden || notConfigured ? undefined : (
              <Link
                to={Paths.instance.agentTracking.team(
                  ctx.organization,
                  ctx.project,
                  ctx.instance
                )}
              >
                <Button size="2" variant="outline" as="span">
                  Review Members
                </Button>
              </Link>
            )
          }
        />
      </Box>
    </Flex>
  );
};
