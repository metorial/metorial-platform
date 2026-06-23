import { css, keyframes } from 'styled-components';

export let fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

export let fadeOutDown = keyframes`
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(4px) scale(0.985);
  }
`;

export let menuEnter = (durationMs = 160) => css`
  animation: ${fadeInUp} ${durationMs}ms cubic-bezier(0.32, 0.72, 0.34, 1.05) both;
`;

export let menuExit = (durationMs = 140) => css`
  animation: ${fadeOutDown} ${durationMs}ms cubic-bezier(0.32, 0.72, 0.34, 1.05) both;
`;
