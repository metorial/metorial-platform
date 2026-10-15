import { Button, Progress, theme } from '@metorial/ui';
import type { CSSProperties, ReactNode } from 'react';
import styled from 'styled-components';
import { formatFileSize } from '../lib/formatFileSize';
import { getUploadFileIcon } from './fileIcon';
import { CopyBlock, CopyDescription, CopyTitle } from './styles';

let Row = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  background: ${theme.colors.background};
  transition:
    background 0.2s ease,
    border-color 0.2s ease;

  &[data-drag-active='true'] {
    border-color: ${theme.colors.blue800};
    background: color-mix(in srgb, ${theme.colors.blue800} 10%, transparent);
  }
`;

let RowMain = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`;

let RowIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: ${theme.colors.gray200};
  color: ${theme.colors.gray700};
`;

export interface SelectedFileRowProps {
  file: { name: string; size: number };
  onRemove?: () => void;
  removeLabel?: ReactNode;
  disabled?: boolean;
  details?: ReactNode;
  progress?: number | null;
  dragActive?: boolean;
  style?: CSSProperties;
}

export let SelectedFileRow = ({
  file,
  onRemove,
  removeLabel,
  disabled,
  details,
  progress,
  dragActive,
  style
}: SelectedFileRowProps) => (
  <Row style={style} data-drag-active={!!dragActive}>
    <RowMain>
      <RowIcon>{getUploadFileIcon(file.name, 18)}</RowIcon>

      <CopyBlock>
        <CopyTitle title={file.name}>{file.name}</CopyTitle>
        <CopyDescription>
          {formatFileSize(file.size)}
          {details ? ' · ' : null}
          {details}
        </CopyDescription>
      </CopyBlock>

      {onRemove ? (
        <Button
          type="button"
          size="1"
          variant="outline"
          disabled={disabled}
          onClick={onRemove}
        >
          {removeLabel ?? 'Remove'}
        </Button>
      ) : null}
    </RowMain>

    {progress !== undefined ? (
      <Progress
        value={progress == null ? null : Math.round(progress * 100)}
        max={100}
        size="1"
        aria-label={`Upload progress for ${file.name}`}
      />
    ) : null}
  </Row>
);
