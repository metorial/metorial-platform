import { Logo, Text, theme, Title } from '@metorial-io/ui';
import React from 'react';
import { styled } from 'styled-components';

let Wrapper = styled.div`
  min-height: 100dvh;
  padding: 20px;
  background: white;
  display: flex;
  flex-direction: column;
  gap: 24px;
  align-items: center;
  justify-content: center;

  @media (max-width: 800px) {
    padding: 20px 16px;
  }
`;

let Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

let BrandText = styled.p`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  color: black;
`;

let Box = styled.div`
  --box-width: 1100px;
  --box-height: 680px;
  --border-color: #ccc;
  --dash-length: 10px;
  --dash-gap: 8px;

  position: relative;
  width: min(var(--box-width), calc(100dvw - 40px));
  min-height: min(var(--box-height), calc(100dvh - 40px));
  background: white;

  /* important: Box should not be the scroll container */
  overflow: visible;

  display: flex;
  flex-direction: column;

  @media (max-width: 800px) {
    width: min(var(--box-width), calc(100dvw - 32px));
    min-height: 0;
  }
`;

let BorderOverlay = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  background-image:
    repeating-linear-gradient(
      to right,
      var(--border-color) 0,
      var(--border-color) var(--dash-length),
      transparent var(--dash-length),
      transparent calc(var(--dash-length) + var(--dash-gap))
    ),
    repeating-linear-gradient(
      to right,
      var(--border-color) 0,
      var(--border-color) var(--dash-length),
      transparent var(--dash-length),
      transparent calc(var(--dash-length) + var(--dash-gap))
    ),
    repeating-linear-gradient(
      to bottom,
      var(--border-color) 0,
      var(--border-color) var(--dash-length),
      transparent var(--dash-length),
      transparent calc(var(--dash-length) + var(--dash-gap))
    ),
    repeating-linear-gradient(
      to bottom,
      var(--border-color) 0,
      var(--border-color) var(--dash-length),
      transparent var(--dash-length),
      transparent calc(var(--dash-length) + var(--dash-gap))
    );
  background-size:
    100% 1px,
    100% 1px,
    1px 100%,
    1px 100%;
  background-position:
    top left,
    bottom left,
    top left,
    top right;
  background-repeat: no-repeat;
`;

let Inner = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
  flex: 1;
  position: relative;
  z-index: 1;
  width: 100%;

  /* critical for overflow inside flex children */
  height: 100%;
  min-height: 0;
  min-width: 0;

  @media (max-width: 800px) {
    grid-template-columns: 1fr;
    height: auto;
  }
`;

let Side = styled.section`
  display: flex;
  flex-direction: column;
  padding: 50px;

  overflow: auto;
  min-height: 0;
  min-width: 0;

  -webkit-overflow-scrolling: touch;

  @media (max-width: 800px) {
    padding: 40px 24px;
  }
`;

let IntroSide = styled(Side)`
  background: #fafafa;
  justify-content: center;
  gap: 28px;

  @media (max-width: 800px) {
    display: none;
  }
`;

let IntroBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let Eyebrow = styled.p`
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #666;
  font-weight: 600;
`;

let IntroTitle = styled.h1`
  margin: 0;
  font-size: clamp(30px, 4vw, 38px);
  line-height: 0.95;
  font-weight: 700;
  color: black;
  max-width: 420px;
`;

let IntroText = styled.p`
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: #777;
  max-width: 430px;
  font-weight: 500;
`;

let FeatureList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let FeatureRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

let FeatureMark = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #aaa;
  flex-shrink: 0;
`;

let FeatureText = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
  color: #333;
`;

let IntegrationGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  max-width: 420px;
`;

let IntegrationPill = styled.div`
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1;
  color: #333;
  border: 1px solid #e5e5e5;
  border-radius: 999px;
  background: white;
`;

let Divider = styled.div`
  align-self: stretch;
  background-image: repeating-linear-gradient(
    to bottom,
    var(--border-color) 0,
    var(--border-color) var(--dash-length),
    transparent var(--dash-length),
    transparent calc(var(--dash-length) + var(--dash-gap))
  );
  background-repeat: no-repeat;
  background-size: 1px 100%;
  background-position: center;

  @media (max-width: 800px) {
    display: none;
  }
`;

let ContentRail = styled.div`
  display: flex;
  flex: 1;
  min-height: 100%;
  flex-direction: column;
`;

let Content = styled.div`
  margin: auto 0; /* vertical centering when content is small */
`;

let Main = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 32px;
`;

let Footer = styled.footer`
  margin-top: 32px;

  p {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    color: ${theme.colors.gray600};
    font-weight: 600;
    text-wrap: balance;

    a {
      color: inherit;
      text-decoration: underline;
    }
  }

  @media (max-width: 800px) {
    margin-top: 24px;
  }
`;

export let AuthLayout = ({
  children,
  main
}: {
  children?: React.ReactNode;
  main?: {
    title: React.ReactNode;
    description?: React.ReactNode;
  };
}) => {
  return (
    <Wrapper>
      <Brand>
        <Logo size={28} color="black" />
        <BrandText>Metorial</BrandText>
      </Brand>

      <Box>
        <BorderOverlay />
        <Inner>
          <IntroSide>
            <IntroBlock>
              <Eyebrow>Connect to 1000+ verified integrations</Eyebrow>
              <IntroTitle>Agentic infrastructure to power AI-native companies.</IntroTitle>
              <IntroText>
                Deploy MCP servers with build-in observability and enterprise-grade isolation
                from day one.
              </IntroText>
            </IntroBlock>

            <FeatureList>
              <FeatureRow>
                <FeatureMark />
                <FeatureText>Available via API, MCP & CLI</FeatureText>
              </FeatureRow>

              <FeatureRow>
                <FeatureMark />
                <FeatureText>AI Native Access Control</FeatureText>
              </FeatureRow>

              <FeatureRow>
                <FeatureMark />
                <FeatureText>RBAC, SAML SSO & IAM</FeatureText>
              </FeatureRow>
            </FeatureList>

            <IntegrationGroup>
              <IntegrationPill>Slack</IntegrationPill>
              <IntegrationPill>Notion</IntegrationPill>
              <IntegrationPill>Linear</IntegrationPill>
              <IntegrationPill>Stripe</IntegrationPill>
              <IntegrationPill>Google Drive</IntegrationPill>
              <IntegrationPill>Sentry</IntegrationPill>
              <IntegrationPill>GitHub</IntegrationPill>
              <IntegrationPill>Jira</IntegrationPill>
              <IntegrationPill>Salesforce</IntegrationPill>
            </IntegrationGroup>
          </IntroSide>
          <Divider />
          <Side>
            <ContentRail>
              <Content>
                {main && (
                  <Main>
                    <Title as="h1" weight="bold" size="4">
                      {main.title}
                    </Title>

                    {main.description && (
                      <Text color="gray600" weight="medium" size="2">
                        {main.description}
                      </Text>
                    )}
                  </Main>
                )}

                {children}
              </Content>

              <Footer>
                <p>
                  By signing up for, logging in to and/or using a{' '}
                  <a href="https://metorial.com">Metorial</a> service, you agree to
                  Metorial&apos;s{' '}
                  <a href="https://metorial.com/legal/terms-of-service">terms of service</a>{' '}
                  and <a href="https://metorial.com/legal/privacy-policy">privacy policy</a>.
                </p>
              </Footer>
            </ContentRail>
          </Side>
        </Inner>
      </Box>
    </Wrapper>
  );
};
