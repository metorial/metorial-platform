import { Section, Text } from '@react-email/components';
import React from 'react';

export let Code = ({ code }: { code: string }) => (
  <Section
    style={{
      background: '#fff',
      border: '1px solid #ddd',
      borderRadius: '4px',
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
      {code}
    </Text>
  </Section>
);
