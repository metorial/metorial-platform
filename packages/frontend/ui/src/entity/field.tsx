import React from 'react';
import { styled } from 'styled-components';
import { Spacer } from '../spacer';
import { theme } from '../theme';

let Wrapper = styled('div')`
  display: flex;
  padding: 20px 0px;
  align-items: center;

  @media (max-width: 600px) {
    padding: 20px;
  }
`;

let Content = styled('div')`
  display: flex;
  flex-direction: column;
`;

let Title = styled('h1')`
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
`;

let Description = styled('p')`
  font-size: 12px;
  font-weight: 400;
  color: ${theme.colors.gray700};
  margin-top: 4px;
  line-height: 1;
`;

export let EntityField = ({
  title,
  description,
  value,
  width,
  children,
  position,
  style,
  right,
  prefix,
  suffix,
  prefixNoSpace,
  suffixNoSpace,
  skeleton
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  value?: React.ReactNode;
  width?: string | number;
  children?: React.ReactNode;
  position?: 'inline' | 'grow';
  style?: React.CSSProperties;
  right?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  prefixNoSpace?: boolean;
  suffixNoSpace?: boolean;
  skeleton?: boolean;
}) => {
  if (!position) position = 'grow';

  if (!description) description = value;

  return (
    <Wrapper
      style={{
        width,
        flex: position == 'grow' ? 1 : undefined,
        textAlign: right ? 'right' : undefined,
        ...style
      }}
    >
      {right && <Spacer />}

      {prefix && (
        <div
          style={{
            marginRight: prefixNoSpace ? 0 : 10
          }}
        >
          {prefix}
        </div>
      )}

      <Content>
        {children ? (
          children
        ) : (
          <>
            <Title>{title}</Title>

            {description && (
              <>
                <Spacer height={3} />
                <Description>{description}</Description>
              </>
            )}
          </>
        )}
      </Content>

      {suffix && (
        <div
          style={{
            marginLeft: suffixNoSpace ? 0 : 10
          }}
        >
          {suffix}
        </div>
      )}
    </Wrapper>
  );
};
