import { theme } from '@metorial/ui';
import styled from 'styled-components';

export let Notice = styled.div<{ $tone?: 'neutral' | 'warning' | 'error' }>`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
  min-width: 0;
  padding: 8px 12px;
  border-bottom: 1px solid ${theme.colors.gray300};
  font-size: 12px;
  line-height: 16px;
  color: ${p =>
    p.$tone == 'error'
      ? theme.colors.red900
      : p.$tone == 'warning'
        ? theme.colors.orange900
        : theme.colors.gray700};
  background: ${p =>
    p.$tone == 'error'
      ? theme.colors.red300
      : p.$tone == 'warning'
        ? theme.colors.orange300
        : theme.colors.gray100};
`;

export let NoticeText = styled.span`
  flex: 1;
  min-width: 0;
`;
