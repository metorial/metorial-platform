import { Column, Row, Section, Text } from '@react-email/components';
import type { CSSProperties, ReactElement } from 'react';

type DataListItem = {
  label: string;
  value: string;
};

let container: CSSProperties = {
  // background: '#efefef',
  // border: '1px solid #ccc'
};

type DataListProps = {
  items: DataListItem[];
};

export let DataList = ({ items }: DataListProps): ReactElement => {
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
