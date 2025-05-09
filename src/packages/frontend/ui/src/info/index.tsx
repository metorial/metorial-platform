import { RiInformation2Line } from '@remixicon/react';
import React from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';
import { Tooltip } from '../tooltip';

let Button = styled('button')`
  background: none;
  border: none;
  padding: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.gray600};

  & > div {
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      height: 70%;
      width: 70%;
    }
  }

  &:hover,
  &:focus {
    & > div {
      background: ${theme.colors.gray300};
      color: ${theme.colors.foreground};
    }
  }
`;

export let InfoTooltip = (props: { children: React.ReactNode; size?: string | number }) => {
  return (
    <Tooltip content={props.children}>
      <Button>
        <div
          style={{
            height: props.size ?? 20,
            width: props.size ?? 20
          }}
        >
          <RiInformation2Line />
        </div>
      </Button>
    </Tooltip>
  );
};
