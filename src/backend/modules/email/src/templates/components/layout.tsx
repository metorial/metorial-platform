import { Text as EmailText } from '@react-email/components';
import React from 'react';

export let Layout = ({
  title,
  description,
  children,
  style
}: {
  title: React.ReactNode;
  description: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => {
  return (
    <React.Fragment>
      <EmailText
        style={{
          fontFamily: 'sans-serif',
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 10,
          ...style
        }}
      >
        {title}
      </EmailText>

      <EmailText
        style={{
          fontFamily: 'sans-serif',
          fontSize: 16,
          marginBottom: 20,
          ...style
        }}
      >
        {description}
      </EmailText>

      {children}
    </React.Fragment>
  );
};
