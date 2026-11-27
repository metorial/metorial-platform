import { styled } from 'styled-components';
import { theme } from '../theme';

export let EntityContentRaw = styled('section')`
  padding: 10px 20px;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  flex: 1;

  &:not(:first-child) {
    border-top: solid 1px ${theme.colors.gray300};
  }
`;
