import type { ReactNode } from 'react';
import { Text, theme } from '@metorial/ui';
import styled from 'styled-components';

let CardRoot = styled.section`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, ${theme.colors.foreground} 8%, transparent);
  background: color-mix(in srgb, ${theme.colors.background} 94%, ${theme.colors.gray100});
`;

let CardHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

let CardTitleWrap = styled.div`
  font-weight: 600;
`;

let CardDescriptionWrap = styled.div`
  line-height: 1.5;
`;

export let SurfaceCard = (p: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) => {
  return (
    <CardRoot>
      <CardHeader>
        <CardTitleWrap>
          <Text size="3">{p.title}</Text>
        </CardTitleWrap>
        {p.description ? (
          <CardDescriptionWrap>
            <Text color="gray600" size="2">
              {p.description}
            </Text>
          </CardDescriptionWrap>
        ) : null}
      </CardHeader>

      {p.children}
    </CardRoot>
  );
};
