import { motion } from 'framer-motion';
import React from 'react';
import { useMeasure } from 'react-use';

let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export let AnimateHeight = (props: { children: React.ReactNode }) => {
  let [ref, { height }] = useMeasure();

  if (isSafari) {
    // Safari has a weird bug where it doesn't properly animate height when the content changes.
    // This is a workaround that forces Safari to re-render the component when the content changes.
    return <div>{props.children}</div>;
  }

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
