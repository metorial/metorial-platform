import { Text } from '@metorial/ui';
import React from 'react';
import { keyframes, styled } from 'styled-components';

let frameStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  minWidth: 0
};

let overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  padding: 16,
  textAlign: 'center'
};

let pulse = keyframes`
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.2; }
`;

let Skeleton = styled.div`
  filter: grayscale(1) blur(2px);
  pointer-events: none;
  animation: ${pulse} 1.6s ease-in-out infinite;
`;

let refreshingStyle: React.CSSProperties = {
  opacity: 0.6,
  transition: 'opacity 0.15s ease'
};

export type ChartFrameProps = {
  height: number;
  loading?: boolean;
  isEmpty?: boolean;
  error?: React.ReactNode;
  emptyText?: React.ReactNode;
  placeholder?: React.ReactNode;
  children: React.ReactNode;
};

let FrameMessage = ({
  title,
  detail
}: {
  title: React.ReactNode;
  detail?: React.ReactNode;
}) => (
  <div style={overlayStyle}>
    <Text size="2" weight="medium" color="gray700" align="center">
      {title}
    </Text>

    {detail ? (
      <Text size="1" color="gray600" align="center">
        {detail}
      </Text>
    ) : null}
  </div>
);

export let ChartFrame = ({
  height,
  loading,
  isEmpty,
  error,
  emptyText,
  placeholder,
  children
}: ChartFrameProps) => {
  if (error) {
    return (
      <div style={{ ...frameStyle, height }} role="alert">
        <FrameMessage
          title="Couldn't load this chart."
          detail={typeof error == 'boolean' ? undefined : error}
        />
      </div>
    );
  }

  if (isEmpty && loading) {
    return (
      <div style={{ ...frameStyle, height }} aria-busy>
        {placeholder ? <Skeleton>{placeholder}</Skeleton> : null}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div style={{ ...frameStyle, height }}>
        <FrameMessage title={emptyText ?? 'No data for this time range.'} />
      </div>
    );
  }

  return (
    <div
      style={{ ...frameStyle, minHeight: height, ...(loading ? refreshingStyle : null) }}
      aria-busy={loading || undefined}
    >
      {children}
    </div>
  );
};
