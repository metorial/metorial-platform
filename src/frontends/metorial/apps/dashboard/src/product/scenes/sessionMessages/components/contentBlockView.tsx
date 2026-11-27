import { CodeBlock } from '@metorial/code';
import { Text } from '@metorial/ui';
import { RiFileTextLine, RiImageLine, RiLink, RiMusic2Line } from '@remixicon/react';
import {
  MediaPreview,
  MediaWrapper,
  MessageBlockHeader,
  ResourceLinkRow,
  ResourceMeta,
  ResourceMetaItem
} from '../styles';
import { asRecord, formatRawJson } from '../utils';
import { EmbeddedResourceView } from './embeddedResourceView';
import { TextContentBlock } from './textContentBlock';

export let ContentBlockView = ({ content, index }: { content: any; index: number }) => {
  let record = asRecord(content);
  let type = record?.type ? String(record.type) : undefined;

  if (type === 'text') {
    return <TextContentBlock text={String(record?.text ?? '')} language="markdown" />;
  }

  if (type === 'image') {
    let mimeType = record?.mimeType ? String(record.mimeType) : 'image/png';
    let data = record?.data ? String(record.data) : '';
    return (
      <MediaWrapper>
        <MessageBlockHeader>
          <RiImageLine />
          <span>Image · {mimeType}</span>
        </MessageBlockHeader>
        {data ? (
          <MediaPreview>
            <img src={`data:${mimeType};base64,${data}`} alt={`Image ${index + 1}`} />
          </MediaPreview>
        ) : (
          <Text size="1" color="gray700">
            Image data missing.
          </Text>
        )}
      </MediaWrapper>
    );
  }

  if (type === 'audio') {
    let mimeType = record?.mimeType ? String(record.mimeType) : 'audio/wav';
    let data = record?.data ? String(record.data) : '';
    return (
      <MediaWrapper>
        <MessageBlockHeader>
          <RiMusic2Line />
          <span>Audio · {mimeType}</span>
        </MessageBlockHeader>
        {data ? (
          <MediaPreview>
            <audio controls src={`data:${mimeType};base64,${data}`} />
          </MediaPreview>
        ) : (
          <Text size="1" color="gray700">
            Audio data missing.
          </Text>
        )}
      </MediaWrapper>
    );
  }

  if (type === 'resource_link') {
    let uri = record?.uri ? String(record.uri) : '';
    let name = record?.name ? String(record.name) : uri;
    let description = record?.description ? String(record.description) : null;
    let mimeType = record?.mimeType ? String(record.mimeType) : null;

    return (
      <MediaWrapper>
        <MessageBlockHeader>
          <RiLink />
          <span>Resource Link</span>
        </MessageBlockHeader>
        <ResourceLinkRow href={uri} target="_blank" rel="noreferrer noopener">
          <RiFileTextLine />
          <span>
            <strong>{name}</strong>
            {uri && uri !== name ? ` · ${uri}` : null}
          </span>
        </ResourceLinkRow>
        {description ? (
          <Text size="1" color="gray700">
            {description}
          </Text>
        ) : null}
        {mimeType ? (
          <ResourceMeta>
            <ResourceMetaItem>
              <strong>MIME Type:</strong> {mimeType}
            </ResourceMetaItem>
          </ResourceMeta>
        ) : null}
      </MediaWrapper>
    );
  }

  if (type === 'resource') {
    let resource = asRecord(record?.resource);
    return <EmbeddedResourceView resource={resource} />;
  }

  return <CodeBlock language="json" variant="bordered" code={formatRawJson(content)} />;
};
