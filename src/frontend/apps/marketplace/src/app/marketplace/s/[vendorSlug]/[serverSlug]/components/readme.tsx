'use client';

import { useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import striptags from 'striptags';
import styled from 'styled-components';
import { joinUrls } from '../../../../../../lib/joinUrls';
import './readme.css';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

export let ServerReadme = ({
  readme,
  imageRoot,
  rootPath
}: {
  readme: string;
  imageRoot: string;
  rootPath?: string;
}) => {
  readme = useMemo(() => striptags(readme), [readme]);

  return (
    <Wrapper className="markdown-body">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ node, ...props }) => {
            if (props.src === undefined || typeof props.src != 'string') return null;

            let url: string;

            try {
              url = joinUrls(imageRoot, rootPath, props.src);
            } catch (e) {
              return null;
            }

            return <img {...props} src={url} />;
          }
        }}
      >
        {readme}
      </Markdown>
    </Wrapper>
  );
};
