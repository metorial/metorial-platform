'use client';

import { useIsSSR } from '@looped/hooks';
import { useMemo } from 'react';
import Markdown from 'react-markdown';
import Zoom from 'react-medium-image-zoom';
import remarkGfm from 'remark-gfm';
import striptags from 'striptags';
import styled from 'styled-components';

import 'react-medium-image-zoom/dist/styles.css';
import './readme.css';

let Wrapper = styled.div<{ $fontSize?: string }>`
  display: flex;
  flex-direction: column;
  font-size: ${p => p.$fontSize};
`;

export let Readme = ({
  readme,
  imageRoot,
  fontSize
}: {
  readme: string;
  imageRoot?: string;
  fontSize?: string;
}) => {
  readme = useMemo(() => striptags(readme), [readme]);

  let isServer = useIsSSR();

  return (
    <Wrapper className="markdown-body" $fontSize={fontSize}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ node, ...props }) => {
            if (isServer) return <img {...(props as any)} />;

            let src = props.src as string;
            if (src.startsWith('http'))
              return (
                <Zoom>
                  <img {...(props as any)} />
                </Zoom>
              );

            if (imageRoot) {
              try {
                let url = new URL(src, imageRoot);
                return (
                  <Zoom>
                    <img {...(props as any)} src={url.href} />
                  </Zoom>
                );
              } catch (e) {}
            }

            return null;
          }
        }}
      >
        {readme}
      </Markdown>
    </Wrapper>
  );
};

export let ReadmeHtml = ({ readmeHtml }: { readmeHtml: string }) => {
  return (
    <Wrapper className="markdown-body" dangerouslySetInnerHTML={{ __html: readmeHtml }} />
  );
};
