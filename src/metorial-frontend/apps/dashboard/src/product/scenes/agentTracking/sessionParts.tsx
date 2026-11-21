import { formatNumber } from '@metorial/chart';
import { Badge, Flex, Text } from '@metorial/ui';
import { useNow } from '@metorial/use-now';
import React from 'react';
import styled from 'styled-components';
import {
  activityLabel,
  formatDateTime,
  formatSpan,
  sessionActivity,
  sessionLength
} from './activity';
import { CostValue } from './cost';
import { TruncatedModelName, UnmatchedModelNames } from './modelNames';

export let settlingLabel = 'Settling…';

export let DetailColumns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 20px;
  align-items: start;

  @media (max-width: 1000px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

let unknownModelNamesLimit = 10;

export let formatRequests = (count: number) =>
  `${formatNumber(count)} ${count == 1 ? 'request' : 'requests'}`;

export let clientLabel = (client: { name: string | null; family: string }) =>
  client.name ?? client.family;

export let clientVersion = (client: { version: string | null }) =>
  client.version ? `v${client.version}` : null;

export let costIsSettling = (session: {
  cost: { totalMicros: number | null };
  summaryPending: boolean;
}) => session.summaryPending && session.cost.totalMicros == null;

type SessionSummary = {
  state: 'active' | 'idle' | 'ended';
  lastActivityAt: Date;
  models: { id: string; name: string | null }[];
  unknownModelNames: string[];
  cost: { totalMicros: number | null; isEstimate: boolean };
  requests: number;
  summaryPending: boolean;
};

type Model = { id: string; name: string | null };

let Muted = ({ children }: { children: React.ReactNode }) => (
  <Text as="span" size="2" color="gray600">
    {children}
  </Text>
);

export let modelLabel = (model: Model) => model.name ?? model.id;

export let ModelNameCell = ({
  model,
  unknownModelNames,
  detail = false
}: {
  model: Model | null;
  unknownModelNames: string[];
  detail?: boolean;
}) => (
  <Flex direction="column" gap={2}>
    <Text as="span" size="2" weight="medium" truncate>
      {model ? modelLabel(model) : 'Unknown Model'}
    </Text>

    {detail && model?.name && model.name != model.id ? (
      <Text as="span" size="1" color="gray600" truncate>
        {model.id}
      </Text>
    ) : null}

    {unknownModelNames.length ? (
      <>
        {detail ? (
          <Text as="span" size="1" color="gray600">
            Not matched to the model catalog:
          </Text>
        ) : null}
        <UnmatchedModelNames names={unknownModelNames} />
        {detail && unknownModelNames.length >= unknownModelNamesLimit ? (
          <Text as="span" size="1" color="gray600">
            Possibly others too: only the {unknownModelNamesLimit} with the most requests are
            listed.
          </Text>
        ) : null}
      </>
    ) : null}
  </Flex>
);

export let SessionSummaryCell = ({
  session,
  showStart = false
}: {
  session: {
    startedAt: Date;
    lastActivityAt: Date;
    requests: number;
    summaryPending: boolean;
  };
  showStart?: boolean;
}) => {
  let now = useNow();
  let span = formatSpan(sessionLength(session));
  let requests = session.requests
    ? formatRequests(session.requests)
    : session.summaryPending
      ? settlingLabel
      : null;

  let title = showStart ? `${formatDateTime(session.startedAt, now)} · ${span}` : span;

  return (
    <Flex direction="column" gap={2}>
      <Text as="span" size="2" weight="medium">
        {title}
      </Text>

      {requests ? (
        <Text as="span" size="1" color="gray600" truncate>
          {requests}
        </Text>
      ) : null}
    </Flex>
  );
};

export let SessionModels = ({ session }: { session: SessionSummary }) => {
  let unmatched = session.unknownModelNames;

  if (!session.models.length && !unmatched.length) {
    if (session.summaryPending) return <Muted>{settlingLabel}</Muted>;
    if (!session.requests) return <Muted>—</Muted>;

    return <Muted>Unknown Model</Muted>;
  }

  let names = [
    ...session.models.map(modelLabel),
    ...unmatched.map(name => `${name} (not in the model catalog)`)
  ].join(', ');

  let first = session.models[0];
  let rest = session.models.length + unmatched.length - 1;

  return (
    <span title={names}>
      <Text as="span" size="2" wrap="nowrap">
        {first ? modelLabel(first) : <TruncatedModelName name={unmatched[0]!} />}
        {rest ? (
          <Text as="span" size="2" color="gray600" wrap="nowrap">
            {' '}
            +{rest}
          </Text>
        ) : null}
      </Text>
    </span>
  );
};

export let SessionCost = ({ session }: { session: SessionSummary }) => {
  if (costIsSettling(session)) return <Muted>{settlingLabel}</Muted>;
  if (!session.requests) return <Muted>—</Muted>;

  return <CostValue cost={session.cost} />;
};

export let SessionActivityLabel = ({ session }: { session: SessionSummary }) => {
  let now = useNow();
  let activity = sessionActivity(session, now);

  if (activity.kind == 'ended') return <Muted>Ended</Muted>;

  return (
    <Badge size="1" color={activity.kind == 'active' ? 'green' : 'gray'}>
      {activityLabel(activity)}
    </Badge>
  );
};
