import React from 'react';
import { keyframes, styled } from 'styled-components';
import { theme } from '../theme';
import { createTheme, createThemeToken } from '../theme/tokens';

let spinnerTheme = createTheme({
  duration: createThemeToken(),
  size: createThemeToken(),
  foreground: createThemeToken(),
  background: createThemeToken()
});

let rotate = keyframes`
  0% { transform: rotate(0deg) }
  100% { transform: rotate(360deg) }
`;

let Wrapper = styled('div')`
  display: inline-block;
  animation: ${rotate} ${spinnerTheme.duration} ease infinite;
  border: calc(${spinnerTheme.size} / 7) solid ${spinnerTheme.background};
  border-top-color: ${spinnerTheme.foreground};
  border-radius: 50%;
  width: ${spinnerTheme.size};
  height: ${spinnerTheme.size};
`;

export let Spinner = ({
  size,
  foreground,
  background,
  duration,
  center
}: {
  size?: string | number;
  foreground?: string;
  background?: string;
  duration?: string;
  center?: boolean;
}) => {
  if (typeof size == 'number') size = `${size}px`;

  return (
    <Wrapper
      aria-live="polite"
      title="Loading..."
      style={{
        ...spinnerTheme.setRootStyles({
          duration: duration ?? '900ms',
          size: (size ?? '26px').toString(),
          foreground: foreground ?? theme.colors.black500,
          background: background ?? theme.colors.gray300
        }),

        margin: center ? '0px auto' : undefined
      }}
    />
  );
};

export let CenteredSpinner = (d: Parameters<typeof Spinner>[0]) => (
  <div style={{ display: 'flex', justifyContent: 'center' }}>
    <Spinner {...d} center />
  </div>
);
