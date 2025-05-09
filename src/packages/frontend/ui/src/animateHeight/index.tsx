import { motion } from 'framer-motion';
import React from 'react';
import { useMeasure } from 'react-use';

export let AnimateHeight = (props: { children: React.ReactNode }) => {
  let [ref, { height }] = useMeasure();

  return (
    <motion.div
      animate={{ height }}
      transition={{ duration: 0.2 }}
      style={{ width: '100%', overflowY: 'hidden' }}
    >
      <div ref={ref as any}>{props.children}</div>
    </motion.div>
  );
};
