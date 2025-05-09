import { theme } from '@metorial/ui';
import React from 'react';
import { styled } from 'styled-components';

let Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

let Button = styled('button')`
  background: ${theme.colors.gray300};
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: solid 1px transparent;
  outline: solid 1px transparent;
  transition: all 0.2s;

  &:first-of-type {
    border-radius: 15px 15px 0 0;
  }

  &:last-of-type {
    border-radius: 0 0 15px 15px;
  }

  h2 {
    font-size: 18px;
    font-weight: 600;
  }

  p {
    font-size: 14px;
    color: ${theme.colors.gray600};
    font-weight: 500;
  }

  &:hover,
  &:focus {
    border-color: ${theme.colors.primary};
    outline: solid 1px ${theme.colors.primary};
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

export let BigButtons = Object.assign(
  ({ children }: { children: React.ReactNode }) => {
    return <Wrapper>{children}</Wrapper>;
  },
  {
    Button: ({
      onClick,
      title,
      description,
      disabled
    }: {
      onClick: () => void;
      title: string;
      description: string;
      disabled?: boolean;
    }) => {
      return (
        <Button onClick={onClick} disabled={disabled}>
          <h2>{title}</h2>
          <p>{description}</p>
        </Button>
      );
    }
  }
);
