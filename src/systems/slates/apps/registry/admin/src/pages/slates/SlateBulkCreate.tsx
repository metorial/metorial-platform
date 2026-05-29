import { useCallback, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Flex, Group, Select, Spacer, Text } from '@metorial/ui';
import { BackLink } from '../../components/BackLink';
import { FormWrapper } from '../../components/styled';
import { adminClient, withAuthRedirect } from '../../hooks/client';
import { styled } from 'styled-components';

type FileStatus = 'pending' | 'uploading' | 'done' | 'error';

type QueuedFile = {
  id: string;
  file: File;
  status: FileStatus;
  error?: string;
};

let statusColor = (status: FileStatus) => {
  switch (status) {
    case 'pending':
      return 'gray';
    case 'uploading':
      return 'blue';
    case 'done':
      return 'green';
    case 'error':
      return 'red';
  }
};

let statusLabel = (status: FileStatus) => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'uploading':
      return 'Uploading...';
    case 'done':
      return 'Done';
    case 'error':
      return 'Error';
  }
};

let formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

let fileToBase64 = async (file: File): Promise<string> => {
  let buffer = await file.arrayBuffer();
  return btoa(
    new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
};

let DropZone = styled.div<{ $isDragOver: boolean }>`
  border: 2px dashed ${p => (p.$isDragOver ? '#3b82f6' : '#e2e8f0')};
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  background: ${p => (p.$isDragOver ? '#eff6ff' : '#f8fafc')};
  transition: all 0.15s;

  &:hover {
    border-color: #cbd5e1;
  }
`;

let FileRow = styled(Flex)`
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
`;

export let SlateBulkCreate = () => {
  let { tenantId } = useParams<{ tenantId: string }>();
  let navigate = useNavigate();
  let fileInputRef = useRef<HTMLInputElement>(null);

  let [access, setAccess] = useState<'public' | 'private'>('public');
  let [files, setFiles] = useState<QueuedFile[]>([]);
  let [isUploading, setIsUploading] = useState(false);
  let [isDragOver, setIsDragOver] = useState(false);

  let addFiles = useCallback((newFiles: FileList | File[]) => {
    let toAdd = Array.from(newFiles).filter(f => f.name.endsWith('.zip'));
    setFiles(prev => [
      ...prev,
      ...toAdd.map(file => ({
        id: crypto.randomUUID(),
        file,
        status: 'pending' as FileStatus
      }))
    ]);
  }, []);

  let removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  let handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  let handleUpload = async () => {
    if (!tenantId) return;
    setIsUploading(true);

    let toUpload = files.filter(f => f.status === 'pending' || f.status === 'error');

    for (let queued of toUpload) {
      setFiles(prev =>
        prev.map(f => (f.id === queued.id ? { ...f, status: 'uploading' as FileStatus } : f))
      );

      try {
        let base64 = await fileToBase64(queued.file);
        await withAuthRedirect(() =>
          adminClient.slate.version.create({
            tenantId,
            contentBase64: base64,
            access
          })
        );
        setFiles(prev =>
          prev.map(f => (f.id === queued.id ? { ...f, status: 'done' as FileStatus } : f))
        );
      } catch (err) {
        let message = err instanceof Error ? err.message : 'Upload failed';
        setFiles(prev =>
          prev.map(f =>
            f.id === queued.id
              ? { ...f, status: 'error' as FileStatus, error: message }
              : f
          )
        );
      }
    }

    setIsUploading(false);
  };

  let doneCount = files.filter(f => f.status === 'done').length;
  let errorCount = files.filter(f => f.status === 'error').length;
  let hasRetryable = errorCount > 0 && !isUploading;
  let allDone = files.length > 0 && doneCount === files.length;

  return (
    <Flex direction="column" gap={24}>
      <BackLink to={`/tenants/${tenantId}/slates`}>Back to Slates</BackLink>

      <FormWrapper>
        <Group.Wrapper>
          <Group.Header
            title="Bulk Create Slates"
            description="Upload multiple slate ZIP files at once. Each file will be published sequentially."
          />
          <Group.Content>
            <Flex direction="column" gap={20}>
              <Select
                label="Access Level"
                description="Applies to all slates in this batch."
                value={access}
                onChange={value => setAccess(value as 'public' | 'private')}
                items={[
                  { id: 'public', label: 'Public' },
                  { id: 'private', label: 'Private' }
                ]}
              />

              <Flex direction="column" gap={6}>
                <Text size="2" weight="medium">
                  Slate Packages (ZIP)
                </Text>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".zip"
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files?.length) {
                      addFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
                <DropZone
                  $isDragOver={isDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                >
                  <Text size="2" color="gray600">
                    Drag & drop .zip files here, or click to browse
                  </Text>
                </DropZone>
              </Flex>

              {files.length > 0 && (
                <Flex direction="column" gap={8}>
                  {files.map(queued => (
                    <FileRow key={queued.id} align="center" justify="space-between" gap={12}>
                      <Flex direction="column" gap={2} style={{ minWidth: 0, flex: 1 }}>
                        <Text size="2" weight="medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {queued.file.name}
                        </Text>
                        <Flex align="center" gap={8}>
                          <Text size="1" color="gray600">
                            {formatSize(queued.file.size)}
                          </Text>
                          {queued.error && (
                            <Text size="1" color="red500">
                              {queued.error}
                            </Text>
                          )}
                        </Flex>
                      </Flex>
                      <Flex align="center" gap={8}>
                        <Badge color={statusColor(queued.status)}>
                          {statusLabel(queued.status)}
                        </Badge>
                        <Button
                          size="1"
                          variant="ghost"
                          disabled={isUploading}
                          onClick={() => removeFile(queued.id)}
                        >
                          Remove
                        </Button>
                      </Flex>
                    </FileRow>
                  ))}
                </Flex>
              )}

              {isUploading && (
                <Text size="2" color="gray600">
                  Uploading {doneCount + errorCount} of {files.length}...
                </Text>
              )}

              {!isUploading && files.length > 0 && (doneCount > 0 || errorCount > 0) && (
                <Text size="2" color={errorCount > 0 ? 'red500' : 'green500'}>
                  {doneCount} succeeded{errorCount > 0 ? `, ${errorCount} failed` : ''}
                </Text>
              )}

              <Spacer size={8} />

              <Flex gap={12}>
                {hasRetryable ? (
                  <Button onClick={handleUpload} disabled={isUploading}>
                    Retry Failed
                  </Button>
                ) : (
                  <Button
                    onClick={handleUpload}
                    loading={isUploading}
                    disabled={files.filter(f => f.status === 'pending').length === 0 || isUploading}
                  >
                    Create Slates
                  </Button>
                )}
                {allDone ? (
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/tenants/${tenantId}/slates`)}
                  >
                    Back to Slates
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={isUploading}
                    onClick={() => navigate(`/tenants/${tenantId}/slates`)}
                  >
                    Cancel
                  </Button>
                )}
              </Flex>
            </Flex>
          </Group.Content>
        </Group.Wrapper>
      </FormWrapper>
    </Flex>
  );
};
