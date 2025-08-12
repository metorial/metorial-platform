import { Section, Text } from '@react-email/components';
import React from 'react';

export let Code = ({ code }: { code: string }) => {
  let first3 = code.slice(0, 3);
  let last3 = code.slice(3, 6);

  return (
    <Section
      style={{
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        margin: '20px 0px',
        padding: '6px 15px'
      }}
    >
      <Text
        style={{
          fontSize: '20px',
          textAlign: 'center',
          verticalAlign: 'middle'
        }}
      >
        <span>{first3}</span>
        <span style={{ margin: '0 5px', color: '#aaa' }}>-</span>
        <span>{last3}</span>
      </Text>
    </Section>
  );
};
