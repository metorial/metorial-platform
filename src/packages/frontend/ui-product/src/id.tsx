import { InlineCopy } from '@metorial/ui';
import React from 'react';

export let ID = ({ id }: { id: string | undefined }) => (
  <p
    style={{
      position: 'relative',
      width: 'fit-content',
      paddingRight: 30,
      fontFamily: 'jetbrains mono, monospace'
    }}
  >
    <span>{id}</span>
    <span
      style={{
        position: 'absolute',
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)'
      }}
    >
      <InlineCopy value={id} />
    </span>
  </p>
);
