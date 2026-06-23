import { RiCheckLine, RiFileCopy2Line } from '@remixicon/react';
import copy from 'copy-to-clipboard';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { styled } from 'styled-components';
import { theme } from '../theme';
import { Tooltip } from '../tooltip';

let IconBox = styled(motion.div)`
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  transition:
    background 0.2s ease,
    color 0.2s ease;
`;

let IconLayer = styled(motion.span)`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    height: 70%;
    width: 70%;
  }
`;

let Button = styled('button')`
  background: none;
  border: none;
  padding: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.gray600};

  &:hover,
  &:focus {
    ${IconBox} {
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
          setCopied(true);

          clearTimeout(copiedToRef.current);
          copiedToRef.current = setTimeout(() => {
            setCopied(false);
          }, 2000);
        }}
      >
        <IconBox
          data-copied={copied}
          style={{
            height: props.size ?? 20,
            width: props.size ?? 20
          }}
          animate={{
            scale: copied ? [1, 1.14, 1] : 1
          }}
          whileTap={{ scale: 0.9 }}
          transition={{
            duration: 0.35,
            ease: 'easeOut'
          }}
        >
          <AnimatePresence initial={false}>
            {copied ? (
              <IconLayer
                key="copied"
                initial={{ opacity: 0, scale: 0.5, rotate: -35, y: 8 }}
                animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                exit={{ opacity: 0, scale: 0.6, rotate: 20, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <RiCheckLine />
              </IconLayer>
            ) : (
              <IconLayer
                key="copy"
                initial={{ opacity: 0, scale: 0.8, rotate: -10, y: 6 }}
                animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 10, y: -6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <RiFileCopy2Line />
              </IconLayer>
            )}
          </AnimatePresence>
        </IconBox>
      </Button>
    </Tooltip>
  );
};
