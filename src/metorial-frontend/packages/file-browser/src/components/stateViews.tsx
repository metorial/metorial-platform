import { Button, Skeleton, Spinner, theme } from '@metorial/ui';
import {
  RiErrorWarningLine,
  RiFileForbidLine,
  RiFileWarningLine,
  RiFolderOpenLine,
  RiLockLine,
  RiWifiOffLine
} from '@remixicon/react';
import type { ReactNode } from 'react';
import styled from 'styled-components';
import { describeFileSystemError, type FileSystemErrorCode } from '../lib/errors';

let Center = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 32px 24px;
`;

let Card = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  max-width: 380px;
  text-align: center;
`;

let CardIcon = styled.span<{ $tone: 'gray' | 'red' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-bottom: 6px;
  border-radius: 10px;
  border: 1px solid ${theme.colors.gray400};
  background: ${theme.colors.gray100};
  color: ${p => (p.$tone == 'red' ? theme.colors.red900 : theme.colors.gray700)};
`;

let CardTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.foreground};
`;

let CardDescription = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: ${theme.colors.gray600};
  overflow-wrap: anywhere;
`;

let CardActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 10px;
`;

export let StateCard = (p: {
  icon?: ReactNode;
  tone?: 'gray' | 'red';
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  role?: 'alert' | 'status';
}) => (
  <Center>
    <Card role={p.role}>
      {p.icon ? <CardIcon $tone={p.tone ?? 'gray'}>{p.icon}</CardIcon> : null}
      <CardTitle>{p.title}</CardTitle>
      {p.description ? <CardDescription>{p.description}</CardDescription> : null}
      {p.actions ? <CardActions>{p.actions}</CardActions> : null}
    </Card>
  </Center>
);

let errorIcons: Partial<Record<FileSystemErrorCode, ReactNode>> = {
  not_found: <RiFileWarningLine size={20} />,
  permission_denied: <RiLockLine size={20} />,
  disconnected: <RiWifiOffLine size={20} />,
  not_a_directory: <RiFileForbidLine size={20} />
};

export let ErrorState = (p: {
  error: unknown;
  path?: string;
  onRetry?: () => void;
  extraActions?: ReactNode;
}) => {
  let description = describeFileSystemError(p.error, { path: p.path });

  return (
    <StateCard
      role="alert"
      tone="red"
      icon={errorIcons[description.code] ?? <RiErrorWarningLine size={20} />}
      title={description.title}
      description={description.message}
      actions={
        p.onRetry || p.extraActions ? (
          <>
            {p.extraActions}
            {p.onRetry ? (
              <Button type="button" size="2" variant="outline" onClick={p.onRetry}>
                Try Again
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    />
  );
};

export let LoadingState = (p: { label?: ReactNode }) => (
  <Center>
    <Card role="status">
      <Spinner size={20} />
      {p.label ? <CardDescription>{p.label}</CardDescription> : null}
    </Card>
  </Center>
);

export let EmptyFolderState = (p: { canUpload: boolean; onUpload?: () => void }) => (
  <StateCard
    icon={<RiFolderOpenLine size={20} />}
    title="This folder is empty"
    description={p.canUpload ? 'Drop files here to upload them to this folder.' : undefined}
    actions={
      p.canUpload && p.onUpload ? (
        <Button type="button" size="2" variant="outline" onClick={p.onUpload}>
          Upload Files
        </Button>
      ) : undefined
    }
  />
);

let SkeletonRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  height: 36px;
  padding: 0 12px;
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let Block = styled.span<{ $width: number }>`
  display: block;
  width: ${p => p.$width}px;
  height: 12px;
`;

let skeletonWidths = [180, 120, 220, 140, 160, 100, 200];

export let ListingSkeleton = (p: { rows?: number }) => (
  <div aria-busy="true" aria-label="Loading folder">
    {Array.from({ length: p.rows ?? 7 }, (_, i) => (
      <SkeletonRow key={i}>
        <Skeleton active borderRadius={4}>
          <Block $width={16} />
        </Skeleton>
        <span style={{ flex: 1 }}>
          <Skeleton active borderRadius={4}>
            <Block $width={skeletonWidths[i % skeletonWidths.length]!} />
          </Skeleton>
        </span>
        <Skeleton active borderRadius={4}>
          <Block $width={56} />
        </Skeleton>
        <Skeleton active borderRadius={4}>
          <Block $width={72} />
        </Skeleton>
      </SkeletonRow>
    ))}
  </div>
);
