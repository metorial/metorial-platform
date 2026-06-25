import { motion } from 'framer-motion';
import React, { useEffect, useMemo, useRef, useState } from 'react';

export let AnimateContent = (props: {
  children: React.ReactNode;
  identifier: number | string;
  paddingInline?: number;
}) => {
  let [prevIdentifier, setPrevIdentifier] = useState(() => props.identifier);

  let direction = useMemo(() => {
    if (props.identifier != prevIdentifier) return 'animate' as const;
    return 'none' as const;
  }, [props.identifier, prevIdentifier]);

  let prevChildren = useRef(props.children);

  useEffect(() => {
    let to = setTimeout(() => {
      setPrevIdentifier(props.identifier);
      prevChildren.current = props.children;
    }, 300);

    return () => clearTimeout(to);
  }, [props.identifier]);

  useEffect(() => {
    if (direction == 'none') prevChildren.current = props.children;
  }, [props.children, direction]);

  return (
    <div
      style={{
        // display: 'flex',
        width: '100%',
        position: 'relative',
        padding: `0px ${props.paddingInline ?? 20}px`
      }}
    >
      <motion.div
        initial={direction == 'animate' ? { opacity: 0, scale: 1.2 } : { opacity: 1 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        key={props.identifier}
      >
        {props.children}
      </motion.div>

      {direction != 'none' && (
        <motion.div
          initial={{ opacity: 1, scale: 1 }}
          animate={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          key={prevIdentifier}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%'
          }}
        >
          {prevChildren.current}
        </motion.div>
      )}
    </div>
  );
};
