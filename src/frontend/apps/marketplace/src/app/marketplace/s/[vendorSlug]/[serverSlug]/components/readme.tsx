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
  linkRoot,
  rootPath
}: {
  readme: string;
  imageRoot: string;
  linkRoot: string;
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

            let preprocessor = process.env.IMAGE_LINK_PREPROCESSOR;
            if (preprocessor) url = eval(preprocessor)(url);

            return <img {...props} src={url} />;
          },

          a: ({ node, ...props }) => {
            if (props.href === undefined || typeof props.href != 'string')
              return <a {...(props as any)} />;

            let url: string;

            try {
              url = joinUrls(linkRoot, rootPath, props.href);
            } catch (e) {
              return null;
            }

            return (
              <a {...(props as any)} href={url} target="_blank" rel="noopener noreferrer" />
            );
          }
        }}
      >
        {readme}
      </Markdown>
    </Wrapper>
  );
};
