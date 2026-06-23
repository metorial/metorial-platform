import { Text as EmailText } from '@react-email/components';
import React from 'react';

export let Text = ({
  children,
  style
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => {
  return (
    <EmailText
      style={{
        fontFamily: 'sans-serif',
        fontSize: 14,
        ...style
      }}
    >
      {children}
    </EmailText>
  );
};
