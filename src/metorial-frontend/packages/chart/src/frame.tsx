import { CenteredSpinner, Text } from '@metorial/ui';
import React from 'react';

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

let placeholderStyle: React.CSSProperties = {
  filter: 'grayscale(1) blur(3px)',
  opacity: 0.45,
  pointerEvents: 'none'
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
        {placeholder ? <div style={placeholderStyle}>{placeholder}</div> : null}

        <div style={overlayStyle}>
          <CenteredSpinner />
        </div>
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
    <div style={{ ...frameStyle, minHeight: height }} aria-busy={loading || undefined}>
      {children}

      {loading ? (
        <div style={{ ...overlayStyle, pointerEvents: 'none' }}>
          <CenteredSpinner />
        </div>
      ) : null}
    </div>
  );
};
