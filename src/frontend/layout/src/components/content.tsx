import React from 'react';
import { styled } from 'styled-components';

let Wrapper = styled.div`
  max-width: 1220px;
  margin: 45px auto 30px auto;
  padding: 0 40px;
  width: 100%;

  &[data-theme='slim'] {
    max-width: 600px;
    padding: 0 20px;
  }

  &[data-theme='medium'] {
    max-width: 800px;
    padding: 0 20px;
  }

  &[data-theme='large'] {
    max-width: 1220px;
    padding: 0 40px;
  }

  &[data-theme='full'] {
    max-width: 100%;
    padding: 0 20px;
  }
`;

export let ContentLayout = ({
  children,
  variant = 'large'
}: {
  children: React.ReactNode;
  variant?: 'slim' | 'medium' | 'large' | 'full';
}) => {
  return <Wrapper data-theme={variant}>{children}</Wrapper>;
};
