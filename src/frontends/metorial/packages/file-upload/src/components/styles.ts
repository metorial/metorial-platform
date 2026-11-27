import { theme } from '@metorial/ui';
import styled from 'styled-components';

export let FieldWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  min-width: 0;
`;

export let FieldLabel = styled.span`
  font-size: 12px;
  color: ${theme.colors.gray900};
  margin-bottom: 5px;
  font-weight: 500;
  user-select: none;
`;

export let DropArea = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-width: 0;
  padding: 14px 16px;
  border: 1px dashed ${theme.colors.gray500};
  border-radius: 10px;
  background: ${theme.colors.gray100};
  cursor: pointer;
  outline: none;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    background: ${theme.colors.gray200};
  }

  &[data-drag-active='true'] {
    border-color: ${theme.colors.blue800};
    background: color-mix(in srgb, ${theme.colors.blue800} 10%, transparent);
  }

  &[data-invalid='true'] {
    border-color: ${theme.colors.red700};
  }

  &[data-disabled='true'] {
    cursor: not-allowed;
    opacity: 0.6;

    &:hover {
      background: ${theme.colors.gray100};
    }
  }
`;

export let IconBox = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid ${theme.colors.gray400};
  background: ${theme.colors.background};
  color: ${theme.colors.gray700};
`;

export let CopyBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`;

export let CopyTitle = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: ${theme.colors.foreground};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export let CopyDescription = styled.span`
  font-size: 12px;
  color: ${theme.colors.gray600};
`;

export let Messages = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
`;
