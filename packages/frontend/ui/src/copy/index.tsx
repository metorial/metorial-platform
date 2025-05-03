import { RiCheckLine } from '@remixicon/react';
import copy from 'copy-to-clipboard';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { styled } from 'styled-components';
import { InputLabel, theme } from '..';

let Value = styled('pre')`
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  display: block;
  font-size: 14px;
  padding: 10px;
  border-radius: 8px;
  background: ${theme.colors.gray100};
  color: ${theme.colors.foreground};
  border: 1px solid ${theme.colors.gray300};
`;

let CopyOverlay = styled(motion.div)`
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid ${theme.colors.gray300};
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
`;

let CopyIcon = styled(motion.div)`
  color: white;
  background: ${theme.colors.gray800};
  height: 26px;
  width: 26px;
  border-radius: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

export let useCopy = (topVal?: string) => {
  let [copied, setCopied] = useState(false);

  let topValRef = useRef(topVal);
  topValRef.current = topVal;

  let doCopy = (innerVal?: string) => {
    let value = innerVal || topValRef.current;
    if (!value) return;

    if (copied) return;
    copy(value);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return {
    copied,
    copy: doCopy
  };
};

export let Copy = ({ value, label }: { value: string; label?: string }) => {
  let { copied, copy: doCopy } = useCopy(value);

  return (
    <div
      onClick={c => doCopy()}
      role="button"
      onKeyDown={c => doCopy()}
      tabIndex={0}
      style={{
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {label && <InputLabel>{label}</InputLabel>}

      <div
        style={{
          position: 'relative'
        }}
      >
        <Value>{value}</Value>

        <AnimatePresence>
          {copied && (
            <CopyOverlay
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CopyIcon
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: -10 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <RiCheckLine size={12} strokeWidth={3} />
              </CopyIcon>
            </CopyOverlay>
          )}
        </AnimatePresence>
      </div>

      {/* <Spacer height={10} />

      <div>
        <Button
          onClick={e => {
            e.stopPropagation();
            doCopy();
          }}
          variant="soft"
          type="button"
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div> */}
    </div>
  );
};
