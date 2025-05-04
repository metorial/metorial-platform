import { Column, Row, Section, Text } from '@react-email/components';
import React from 'react';

let container = {
  // background: '#efefef',
  // border: '1px solid #ccc'
};

export let DataList = ({ items }: { items: { label: string; value: string }[] }) => {
  return (
    <Section style={container}>
      {items.map(({ label, value }, i) => (
        <Row key={i}>
          <Column style={{ padding: '10px 0px' }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', padding: '3px 0px', margin: 0 }}>
              {label}:{' '}
            </Text>
            <Text style={{ fontSize: 14, padding: '3px 0px', margin: 0 }}>{value}</Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
};
