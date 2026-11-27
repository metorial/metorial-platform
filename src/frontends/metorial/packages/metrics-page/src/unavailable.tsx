import { Callout } from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';

let Action = styled.span`
  display: inline-flex;
  margin-left: auto;
  padding-left: 12px;
`;

export let MetricsUnavailable = ({
  children,
  action
}: {
  children?: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <Callout color="orange">
    <span>
      {children ?? 'Metrics are temporarily unavailable. Try again in a few minutes.'}
    </span>
    {action ? <Action>{action}</Action> : null}
  </Callout>
);
