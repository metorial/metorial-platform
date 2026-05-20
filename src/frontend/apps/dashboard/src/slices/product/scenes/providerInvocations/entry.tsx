import type { DashboardInstanceProviderInvocationsListOutput } from '@metorial/dashboard-sdk';
import { Badge, Button, RenderDate, theme } from '@metorial/ui';
import { RiKey2Line, RiPulseLine, RiShieldKeyholeLine, RiToolsLine } from '@remixicon/react';
import { useInView } from 'framer-motion';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { RunLogs } from '../../components/runLogs';
import { formatTitleCase } from './helpers';
import { showProviderInvocationPanel } from './panel';

type InvocationItem = DashboardInstanceProviderInvocationsListOutput['items'][number];

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let Header = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  color: ${theme.colors.gray600};

  > svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  > .title {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;

    span {
      font-size: 13px;
      font-weight: 500;
      color: ${theme.colors.gray800};
    }
  }

  time {
    font-size: 13px;
  }

  &[data-variant='error'] {
    color: ${theme.colors.red600};

    > .title span {
      color: ${theme.colors.red700};
    }
  }
`;

let Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

let getInvocationIcon = (type: InvocationItem['type']): ReactNode => {
  switch (type) {
    case 'tool_call':
      return <RiToolsLine />;
    case 'auth_config_event':
      return <RiShieldKeyholeLine />;
    case 'oauth_setup':
      return <RiKey2Line />;
    default:
      return <RiPulseLine />;
  }
};

let getInvocationTitle = (invocation: InvocationItem): string => {
  if (invocation.action?.name) return invocation.action.name;
  if (invocation.action?.key) return invocation.action.key;
  return formatTitleCase(invocation.type);
};

let InvocationLogs = ({
  deferBody,
  invocation
}: {
  deferBody?: boolean;
  invocation: InvocationItem;
}) => {
  let ref = useRef<HTMLDivElement>(null);
  let inView = useInView(ref, { margin: '200px 0px' });
  let [canRender, setCanRender] = useState(!deferBody);

  useEffect(() => {
    if (inView) setCanRender(true);
  }, [inView]);

  return (
    <div ref={ref}>
      {canRender ? (
        <RunLogs
          logs={invocation.logs}
          hideWhenEmpty={false}
          title="Output"
          emptyText="No output logs captured."
        />
      ) : null}
    </div>
  );
};

export let ProviderInvocationEntry = ({
  deferBody = false,
  invocation
}: {
  deferBody?: boolean;
  invocation: InvocationItem;
}) => {
  let variant: 'error' | 'default' = invocation.status === 'error' ? 'error' : 'default';

  return (
    <Wrapper>
      <Header data-variant={variant}>
        {getInvocationIcon(invocation.type)}

        <div className="title">
          <span>{getInvocationTitle(invocation)}</span>
          <Badge size="1" color={invocation.status === 'error' ? 'red' : 'green'}>
            {formatTitleCase(invocation.status)}
          </Badge>
        </div>

        <Actions>
          <Button
            size="2"
            onClick={() =>
              showProviderInvocationPanel({ providerInvocationId: invocation.id })
            }
          >
            View invocation details
          </Button>
        </Actions>

        <time>
          <RenderDate date={invocation.createdAt} />
        </time>
      </Header>

      <InvocationLogs deferBody={deferBody} invocation={invocation} />
    </Wrapper>
  );
};
