'use client';

import { useMemo } from 'react';
import Markdown from 'react-markdown';
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

  return (
    <Wrapper className="markdown-body">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ node, ...props }) => {
            if (props.src === undefined) return null;

            let image = <img {...props} />;

            if (typeof props.src == 'string' && !props.src.startsWith('http') && imageRoot) {
              try {
                let url = new URL(props.src, imageRoot);
                image = <img {...props} src={url.href} />;
              } catch (e) {}
            }

            return image;
          }
        }}
      >
        {readme}
      </Markdown>
    </Wrapper>
  );
};
