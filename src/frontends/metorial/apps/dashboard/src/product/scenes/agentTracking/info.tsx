import { InfoTooltip } from '@metorial/ui';
import React from 'react';

export let WithInfo = ({
  info,
  children
}: {
  info: React.ReactNode;
  children: React.ReactNode;
}) =>
  info ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {children}
      <span style={{ display: 'inline-flex', margin: '-3px 0' }}>
        <InfoTooltip size={16}>{info}</InfoTooltip>
      </span>
    </span>
  ) : (
    <>{children}</>
  );
