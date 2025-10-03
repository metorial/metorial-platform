import { theme } from '@metorial/ui';
import { motion } from 'framer-motion';

export let BreathingIndicator = () => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '16px',
          height: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: theme.colors.green900,
            zIndex: 10
          }}
        />

        <motion.div
          style={{
            position: 'absolute',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: theme.colors.green600
          }}
          animate={{
            width: ['8px', '21px'],
            height: ['8px', '21px'],
            opacity: [1, 0]
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            ease: 'easeOut',
            repeatDelay: 0.5
          }}
        />
      </div>
    </div>
  );
};
