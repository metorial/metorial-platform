import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text
} from '@react-email/components';
import React from 'react';

let main = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
};

let container = {
  maxWidth: '600px',
  margin: '0 auto'
};

let logoContainer = {
  marginTop: '25px'
};

let footerText = {
  fontSize: '12px',
  color: '#777'
};

let hr = {
  margin: '20px 0px',
  border: 'none',
  borderBottom: '1px solid #ddd',
  background: 'none'
};

export let Wrapper = ({
  children,
  preview
}: {
  children?: React.ReactNode;
  preview?: string;
}) => {
  return (
    <Html>
      <Head />

      {preview && <Preview>{preview}</Preview>}

      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img
              src="https://cdn.metorial.com/2024-08-17--09-31-34/logos/metorial/primary_logo_text/resized-100-w888-h256.png"
              height="30"
              alt="Metorial"
            />
          </Section>

          {children}

          <Hr style={hr} />

          <Section>
            <Text style={footerText}>
              Sent by Metorial 💌. If you have any questions, feel free to contact us. If you
              need to reference this message use this ID: EMAIL_ID.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};
