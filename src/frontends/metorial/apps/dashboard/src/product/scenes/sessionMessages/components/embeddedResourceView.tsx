import { Text } from '@metorial/ui';
import { RiFileTextLine, RiImageLine, RiMusic2Line } from '@remixicon/react';
import {
  MediaPreview,
  MessageBlockHeader,
  MessageBlockWrapper,
  ResourceMeta,
  ResourceMetaItem
} from '../styles';
import { detectLanguage, isAudioMime, isImageMime } from '../utils';
import { TextContentBlock } from './textContentBlock';

export let EmbeddedResourceView = ({
  resource
}: {
  resource: Record<string, any> | null | undefined;
}) => {
  if (!resource) {
    return (
      <Text size="1" color="gray700">
        Empty resource.
      </Text>
    );
  }

  let uri = resource.uri ? String(resource.uri) : null;
  let mimeType = resource.mimeType ? String(resource.mimeType) : null;
  let name = resource.name ? String(resource.name) : null;
  let title = resource.title ? String(resource.title) : null;
  let hasBlob = typeof resource.blob === 'string' && resource.blob.length > 0;
  let text = typeof resource.text === 'string' ? resource.text : null;
  let language = detectLanguage(mimeType, uri);

  return (
    <MessageBlockWrapper>
      <MessageBlockHeader>
        {isImageMime(mimeType) ? (
          <RiImageLine />
        ) : isAudioMime(mimeType) ? (
          <RiMusic2Line />
        ) : (
          <RiFileTextLine />
        )}
        <span>Resource{title || name ? ` · ${title ?? name}` : ''}</span>
      </MessageBlockHeader>

      {(uri || mimeType) && (
        <ResourceMeta>
          {uri ? (
            <ResourceMetaItem>
              <strong>URI:</strong> {uri}
            </ResourceMetaItem>
          ) : null}
          {mimeType ? (
            <ResourceMetaItem>
              <strong>MIME Type:</strong> {mimeType}
            </ResourceMetaItem>
          ) : null}
        </ResourceMeta>
      )}

      {text != null ? (
        <TextContentBlock text={text} language={language} />
      ) : hasBlob && isImageMime(mimeType) ? (
        <MediaPreview>
          <img
            src={`data:${mimeType};base64,${String(resource.blob)}`}
            alt={name ?? title ?? uri ?? 'Resource'}
          />
        </MediaPreview>
      ) : hasBlob && isAudioMime(mimeType) ? (
        <MediaPreview>
          <audio controls src={`data:${mimeType};base64,${String(resource.blob)}`} />
        </MediaPreview>
      ) : hasBlob ? (
        <Text size="1" color="gray700">
          Binary content ({String(resource.blob).length.toLocaleString()} base64 chars).
        </Text>
      ) : (
        <Text size="1" color="gray700">
          No inline content.
        </Text>
      )}
    </MessageBlockWrapper>
  );
};
