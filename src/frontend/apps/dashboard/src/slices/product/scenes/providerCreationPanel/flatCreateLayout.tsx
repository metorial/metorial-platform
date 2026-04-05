import { theme } from '@metorial/ui';
import styled from 'styled-components';

export let FlatCreateSections = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export let FlatCreateSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};
`;
