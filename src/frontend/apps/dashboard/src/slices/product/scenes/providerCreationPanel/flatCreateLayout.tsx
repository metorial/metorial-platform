import { theme } from '@metorial/ui';
import styled from 'styled-components';

export let FlatCreateSections = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

export let FlatCreateSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid ${theme.colors.gray300};
`;

export let FlatCreateSectionLabel = styled.div`
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: ${theme.colors.gray700};
  margin: 0 0 8px 0;
`;
