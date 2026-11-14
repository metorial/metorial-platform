import { Button as EmailButton, Section } from '@react-email/components';
import React from 'react';

let buttonContainer = {
  padding: '27px 0 27px',
  textAlign: 'center' as const
};

let button = {
  backgroundColor: '#000000',
  borderRadius: '7px',
  fontWeight: '600',
  color: '#fff',
  fontSize: '15px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block'
};

export let Button = ({ href, children }: { href: string; children: React.ReactNode }) => {
  return (
    <Section style={buttonContainer}>
      <EmailButton style={{ ...button, padding: '12px 18px' }} href={href}>
        {children as any}
      </EmailButton>
    </Section>
  );
};
