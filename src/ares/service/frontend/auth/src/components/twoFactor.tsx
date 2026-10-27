import { Text, theme } from '@metorial-io/ui';
import { css, keyframes, styled } from 'styled-components';

let scan = keyframes`
  0%, 100% { transform: translateY(-24px); opacity: 0; }
  20%, 80% { opacity: .5; }
  85% { transform: translateY(24px); }
`;

export let SetupPanel = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  background: ${theme.colors.gray100};

  & > div:not(:last-child) {
    border-bottom: 1px solid ${theme.colors.gray300};
  }

  & > div {
    padding: 20px;
  }
`;

export let AccountHint = ({ action, email }: { action: string; email: string }) => (
  <Text size="2" color="gray600">
    {action} {email}
  </Text>
);

export let MethodList = styled.div`
  display: grid;
  gap: 10px;
`;

let MethodIconWrapper = styled.span`
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 9px;
  background: ${theme.colors.gray100};
  flex-shrink: 0;
`;

export let MethodButton = styled.button`
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 17px;
  text-align: left;
  color: ${theme.colors.gray900};
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.gray300};
  border-radius: 9px;
  cursor: pointer;
  font: inherit;
  transition:
    background 0.2s,
    border-color 0.2s;

  > div {
    justify-content: flex-start;
    gap: 14px;
    width: 100%;
    min-width: 0;
    flex-shrink: 1;
  }

  > div > div {
    min-width: 0;
    flex: 1;
  }

  &:hover {
    background: ${theme.colors.gray100};

    & > ${MethodIconWrapper} {
      background: ${theme.colors.gray200};
    }
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.gray600};
    outline-offset: 3px;
  }
`;

export let MethodIcon = ({ type }: { type: 'totp' | 'passkey' }) => (
  <MethodIconWrapper>
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === 'totp' ? (
        <>
          <rect x="6" y="2" width="12" height="20" rx="3" />
          <path d="M10 18h4" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="5" />
          <path d="m12 12 9 9m-3-3 3-3m-6 0 3-3" />
        </>
      )}
    </svg>
  </MethodIconWrapper>
);

let Animation = styled.div<{ $state: 'idle' | 'working' | 'verified' }>`
  display: grid;
  place-items: center;
  height: 176px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 12px;
  background: ${theme.colors.gray100};

  svg {
    width: 100px;
    height: 100px;
    overflow: visible;
  }
  .frame,
  .person {
    stroke: ${theme.colors.gray800};
    fill: none;
    stroke-width: 2.6;
    stroke-linecap: round;
    transition: opacity 0.4s;
  }
  .scan {
    stroke: ${theme.colors.gray600};
    opacity: 0;
  }
  .square {
    fill: none;
    stroke: ${theme.colors.green700};
    stroke-width: 2.6;
    stroke-dasharray: 270;
    stroke-dashoffset: 270;
    opacity: 0;
    transition:
      stroke-dashoffset 0.7s,
      opacity 0.3s;
  }
  .tick {
    fill: none;
    stroke: ${theme.colors.green700};
    stroke-width: 3.3;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 65;
    stroke-dashoffset: 65;
    transition: stroke-dashoffset 0.45s 0.25s;
  }

  ${({ $state }) =>
    $state === 'working' &&
    css`
      .scan {
        animation: ${scan} 1.5s ease-in-out infinite;
      }
    `}
  ${({ $state }) =>
    $state === 'verified' &&
    css`
      .frame,
      .person {
        opacity: 0;
      }
      .square {
        opacity: 1;
        stroke-dashoffset: 0;
      }
      .tick {
        stroke-dashoffset: 0;
      }
    `}

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
  }
`;

export let PasskeyAnimation = ({ state }: { state: 'idle' | 'working' | 'verified' }) => (
  <Animation
    $state={state}
    role="img"
    aria-label={state === 'verified' ? 'Passkey verified' : 'Verify with your passkey'}
  >
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path
        className="frame"
        d="M16 36V24a8 8 0 0 1 8-8h12m28 0h12a8 8 0 0 1 8 8v12m0 28v12a8 8 0 0 1-8 8H64m-28 0H24a8 8 0 0 1-8-8V64"
      />
      <g className="person">
        <circle cx="50" cy="39" r="11" />
        <path d="M30 70c0-22 40-22 40 0" />
      </g>
      <path className="scan" d="M18 50h64" />
      <rect className="square" x="16" y="16" width="68" height="68" rx="17" />
      <path className="tick" d="m33 50 12 12 23-25" />
    </svg>
  </Animation>
);
