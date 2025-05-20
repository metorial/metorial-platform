'use client';

import { useIsSSR } from '@looped/hooks';
import { useMemo } from 'react';
import Markdown from 'react-markdown';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';
import remarkGfm from 'remark-gfm';
import striptags from 'striptags';
import styled from 'styled-components';
import './readme.css';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

export let ServerReadme = ({ readme, imageRoot }: { readme: string; imageRoot?: string }) => {
  readme = useMemo(() => striptags(readme), [readme]);

  let isServer = useIsSSR();

  return (
    <Wrapper className="markdown-body">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ node, ...props }) => {
            if (isServer) return <img {...props} />;

            let src = props.src as string;
            if (src.startsWith('http'))
              return (
                <Zoom>
                  <img {...props} />
                </Zoom>
              );

            if (imageRoot) {
              try {
                let url = new URL(src, imageRoot);
                return (
                  <Zoom>
                    <img {...props} src={url.href} />
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
