import { css } from 'styled-components';
import { theme } from '../theme';

export let floatingTokens = {
  border: theme.colors.gray350,
  shadow: '0 1px 2px rgba(0, 0, 0, 0.03), 0 4px 14px rgba(0, 0, 0, 0.05)',
  popShadow: '0 4px 14px rgba(0, 0, 0, 0.05)',
  ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  zIndex: 9000
};

export let floatingSurface = css`
  border: 1px solid ${floatingTokens.border};
  background: ${theme.colors.background};
  box-shadow: ${floatingTokens.shadow};
`;

export let floatingPopupSurface = css`
  border: 1px solid ${floatingTokens.border};
  border-radius: 10px;
  background: ${theme.colors.background};
  box-shadow: ${floatingTokens.popShadow};
  color: ${theme.colors.foreground};
  outline: none;
  transform-origin: var(--transform-origin);
  transition:
    opacity 0.12s ease,
    transform 0.16s ${floatingTokens.ease};

  &[data-starting-style],
  &[data-ending-style] {
    opacity: 0;
    transform: scale(0.98);
  }
`;
