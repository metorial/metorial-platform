import { Logo, Spacer, Text, theme, Title } from '@metorial-io/ui';
import React from 'react';
import { styled } from 'styled-components';

let Wrapper = styled.div`
  min-height: 100dvh;
  padding: 20px;
  box-sizing: border-box;
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

let BrandSlot = styled.div`
  min-height: 30px;
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
  width: min(460px, 100%);
  display: flex;
  flex-direction: column;
`;

let Content = styled.div`
  width: 100%;
  min-width: 0;
`;

let Inner = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  min-width: 0;
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
      <BrandSlot>
        <Brand>
          <Logo size={30} color="black" />
          <BrandText>Metorial</BrandText>
        </Brand>
      </BrandSlot>

      <Box>
        <Content>
          <Inner>
            {main && (
              <>
                <Title as="h1" weight="bold" size="5">
                  {main.title}
                </Title>

                {main.description && (
                  <>
                    <Spacer size={5} />
                    <Text color="gray700" weight="medium" size="3">
                      {main.description}
                    </Text>
                  </>
                )}

                <Spacer size={25} />
              </>
            )}

            {children}
          </Inner>

          <Footer>
            <p>
              By signing up for, logging in to and/or using a{' '}
              <a href="https://metorial.com">Metorial</a> service, you agree to
              Metorial&apos;s{' '}
              <a href="https://metorial.com/legal/terms-of-service">terms of service</a>{' '}
              and <a href="https://metorial.com/legal/privacy-policy">privacy policy</a>.
            </p>
          </Footer>
        </Content>
      </Box>
    </Wrapper>
  );
};
