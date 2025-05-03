import { motion } from 'framer-motion';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimateHeight } from '../animateHeight';

export let AnimatePanes = (props: {
  children: React.ReactNode;
  orderedIdentifier: number;
}) => {
  let [prevOrderedIdentifier, setPrevOrderedIdentifier] = useState(
    () => props.orderedIdentifier
  );

  let direction = useMemo(() => {
    if (props.orderedIdentifier > prevOrderedIdentifier) return 'left' as const;
    if (props.orderedIdentifier < prevOrderedIdentifier) return 'right' as const;
    return 'none' as const;
  }, [props.orderedIdentifier, prevOrderedIdentifier]);

  let prevChildren = useRef(props.children);

  useEffect(() => {
    let to = setTimeout(() => {
      setPrevOrderedIdentifier(props.orderedIdentifier);
      prevChildren.current = props.children;
    }, 300);

    return () => clearTimeout(to);
  }, [props.orderedIdentifier]);

  useEffect(() => {
    if (direction == 'none') prevChildren.current = props.children;
  }, [props.children, direction]);

  return (
    <AnimateHeight>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
          padding: 3
        }}
      >
        <motion.div
          initial={{ x: direction == 'right' ? '-100%' : direction == 'left' ? '100%' : 0 }}
          animate={{ x: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          key={props.orderedIdentifier}
        >
          {props.children}
        </motion.div>

        {direction != 'none' && (
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: direction == 'right' ? '100%' : '-100%' }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            key={prevOrderedIdentifier}
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
    </AnimateHeight>
  );
};
