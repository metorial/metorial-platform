import { Button, Progress, Spinner, theme } from '@metorial/ui';
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiCheckLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiRefreshLine
} from '@remixicon/react';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import styled from 'styled-components';
import { formatFileSize } from '../lib/formatFileSize';
import type { UploadItem, UploadQueueSummary } from '../queue/queue';
import type { UploadQueueHandle } from '../queue/useUploadQueue';
import { getUploadFileIcon } from './fileIcon';

let Tray = styled.section`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.medium};
  overflow: hidden;
`;

let Header = styled.header`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px 10px 12px;
`;

let HeaderIcon = styled.span<{ $tone: 'gray' | 'green' | 'red' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 18px;
  height: 18px;
  color: ${p =>
    p.$tone == 'green'
      ? theme.colors.green900
      : p.$tone == 'red'
        ? theme.colors.red900
        : theme.colors.gray700};
`;

let HeaderCopy = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

let HeaderTitle = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${theme.colors.foreground};
`;

let HeaderDescription = styled.span`
  font-size: 12px;
  color: ${theme.colors.gray600};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
`;

let OverallProgress = styled.div`
  padding: 0 12px 10px;
`;

let List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 0;
  padding: 6px;
  list-style: none;
  border-top: 1px solid ${theme.colors.gray300};
  overflow-y: auto;
`;

let Item = styled.li`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 6px 6px 8px;
  border-radius: 6px;
  transition: background 0.2s ease;

  &:hover {
    background: ${theme.colors.gray200};
  }
`;

let ItemRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

let ItemIcon = styled.span`
  display: inline-flex;
  flex: none;
  color: ${theme.colors.gray700};
`;

let ItemCopy = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

let ItemName = styled.span`
  font-size: 13px;
  color: ${theme.colors.foreground};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let ItemMeta = styled.span<{ $error?: boolean }>`
  font-size: 12px;
  color: ${p => (p.$error ? theme.colors.red900 : theme.colors.gray600)};
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let ItemDone = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex: none;
  color: ${theme.colors.green900};
`;

let plural = (count: number, word: string) => `${count} ${word}${count == 1 ? '' : 's'}`;

export let getUploadTrayTitle = (summary: UploadQueueSummary) => {
  if (summary.active > 0) return `Uploading ${plural(summary.active, 'file')}`;
  if (summary.failed > 0) return `${plural(summary.failed, 'upload')} failed`;
  if (summary.done > 0) return `Uploaded ${plural(summary.done, 'file')}`;

  return 'Uploads cancelled';
};

let describeItemStatus = (item: UploadItem<any>) => {
  if (item.status == 'queued') return 'Waiting';
  if (item.status == 'cancelled') return 'Cancelled';
  if (item.status == 'error') return item.error ?? 'Upload failed.';
  if (item.status == 'done') return formatFileSize(item.total);

  return `${formatFileSize(item.loaded)} of ${formatFileSize(item.total)}`;
};

export interface UploadTrayProps<M = unknown> {
  queue: Pick<
    UploadQueueHandle<M>,
    'items' | 'summary' | 'cancel' | 'retry' | 'remove' | 'clear'
  >;
  title?: ReactNode;
  description?: ReactNode;
  getItemDescription?: (item: UploadItem<M>) => ReactNode;
  defaultCollapsed?: boolean;
  onClose?: () => void;
  maxListHeight?: number;
  style?: CSSProperties;
  className?: string;
}

export let UploadTray = <M,>({
  queue,
  title,
  description,
  getItemDescription,
  defaultCollapsed = false,
  onClose,
  maxListHeight = 240,
  style,
  className
}: UploadTrayProps<M>) => {
  let [collapsed, setCollapsed] = useState(defaultCollapsed);
  let listId = useId();
  let { items, summary } = queue;

  if (!items.length) return null;

  let isActive = summary.active > 0;
  let percent = Math.round(summary.progress * 100);
  let tone: 'gray' | 'green' | 'red' = isActive
    ? 'gray'
    : summary.failed > 0
      ? 'red'
      : 'green';

  return (
    <Tray style={style} className={className} aria-label="Uploads">
      <Header>
        <HeaderIcon $tone={tone}>
          {isActive ? (
            <Spinner size={14} />
          ) : summary.failed > 0 ? (
            <RiErrorWarningLine size={18} />
          ) : (
            <RiCheckLine size={18} />
          )}
        </HeaderIcon>

        <HeaderCopy>
          <HeaderTitle aria-live="polite">{title ?? getUploadTrayTitle(summary)}</HeaderTitle>
          {description || isActive ? (
            <HeaderDescription>
              {description}
              {description && isActive ? ' · ' : null}
              {isActive ? `${percent}%` : null}
            </HeaderDescription>
          ) : null}
        </HeaderCopy>

        <HeaderActions>
          <Button
            type="button"
            size="1"
            variant="ghost"
            aria-label={collapsed ? 'Show uploads' : 'Hide uploads'}
            aria-expanded={!collapsed}
            aria-controls={listId}
            iconLeft={collapsed ? <RiArrowUpSLine /> : <RiArrowDownSLine />}
            onClick={() => setCollapsed(c => !c)}
          />

          {!isActive ? (
            <Button
              type="button"
              size="1"
              variant="ghost"
              aria-label="Close uploads"
              iconLeft={<RiCloseLine />}
              onClick={onClose ?? queue.clear}
            />
          ) : null}
        </HeaderActions>
      </Header>

      {collapsed && isActive ? (
        <OverallProgress>
          <Progress value={percent} size="1" aria-label="Overall upload progress" />
        </OverallProgress>
      ) : null}

      {!collapsed ? (
        <List id={listId} style={{ maxHeight: maxListHeight }}>
          {items.map(item => {
            let extra = getItemDescription?.(item);

            return (
              <Item key={item.id}>
                <ItemRow>
                  <ItemIcon>{getUploadFileIcon(item.name)}</ItemIcon>

                  <ItemCopy>
                    <ItemName title={item.name}>{item.name}</ItemName>
                    <ItemMeta $error={item.status == 'error'} title={item.error}>
                      {describeItemStatus(item)}
                      {extra ? ' · ' : null}
                      {extra}
                    </ItemMeta>
                  </ItemCopy>

                  {item.status == 'queued' || item.status == 'uploading' ? (
                    <Button
                      type="button"
                      size="1"
                      variant="ghost"
                      aria-label={`Cancel upload of ${item.name}`}
                      iconLeft={<RiCloseLine />}
                      onClick={() => queue.cancel(item.id)}
                    />
                  ) : null}

                  {item.status == 'error' || item.status == 'cancelled' ? (
                    <>
                      <Button
                        type="button"
                        size="1"
                        variant="ghost"
                        aria-label={`Retry upload of ${item.name}`}
                        iconLeft={<RiRefreshLine />}
                        onClick={() => queue.retry(item.id)}
                      />
                      <Button
                        type="button"
                        size="1"
                        variant="ghost"
                        aria-label={`Dismiss ${item.name}`}
                        iconLeft={<RiCloseLine />}
                        onClick={() => queue.remove(item.id)}
                      />
                    </>
                  ) : null}

                  {item.status == 'done' ? (
                    <ItemDone aria-label="Uploaded">
                      <RiCheckLine size={16} />
                    </ItemDone>
                  ) : null}
                </ItemRow>

                {item.status == 'uploading' ? (
                  <Progress
                    value={Math.round(item.progress * 100)}
                    size="1"
                    aria-label={`Upload progress for ${item.name}`}
                  />
                ) : null}
              </Item>
            );
          })}
        </List>
      ) : null}
    </Tray>
  );
};
