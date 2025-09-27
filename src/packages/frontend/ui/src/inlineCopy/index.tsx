import { RiCheckLine, RiFileCopy2Line } from '@remixicon/react';
import copy from 'copy-to-clipboard';
import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
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

export let InlineCopy = (props: {
  size?: string | number;
  tooltip?: string;
  value?: string;
}) => {
  let [copied, setCopied] = useState(false);
  let copiedToRef = useRef<any>(null);

  if (!props.value) return null;

  return (
    <Tooltip content={props.tooltip ?? 'Copy'}>
      <Button
        type="button"
        onClick={e => {
          e.stopPropagation();
          e.preventDefault();

          copy(props.value!);
          toast.success('Copied to clipboard');

          clearTimeout(copiedToRef.current);
          copiedToRef.current = setTimeout(() => {
            setCopied(false);
          }, 2000);
        }}
      >
        <div
          style={{
            height: props.size ?? 20,
            width: props.size ?? 20
          }}
        >
          {copied ? <RiCheckLine /> : <RiFileCopy2Line />}
        </div>
      </Button>
    </Tooltip>
  );
};
