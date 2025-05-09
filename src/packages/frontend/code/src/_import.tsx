import { theme } from '@metorial/ui';
import { Highlight, Prism } from 'prism-react-renderer';
import React, { useRef } from 'react';
import { useScroll } from 'react-use';
import { styled } from 'styled-components';
import prismTheme from './theme';

(typeof global != 'undefined' ? global : window).Prism = Prism;

// @ts-ignore
let prism = import('prismjs/components/prism-json');

let Wrapper = styled('div')`
  border-radius: 10px;
  background: white;
  overflow: hidden;
`;

let Main = styled('div')`
  position: relative;
`;

let Overflow = styled('div')`
  overflow-x: auto;
  display: flex;
  position: relative;
`;

let RightShadow = styled('div')`
  position: sticky;
  right: 0;
  width: 50px;
  background: linear-gradient(to right, rgba(255, 255, 255, 0), white);
  flex-shrink: 0;
`;

let LeftShadow = styled('div')`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 50px;
  background: linear-gradient(to left, rgba(255, 255, 255, 0), white);
  z-index: 1;
  transition: opacity 0.3s ease;
`;

let Pre = styled('pre')`
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  margin: 0;
  padding: var(--padding) 0px;
`;

let Line = styled('div')`
  line-height: 1.5;
  padding: 0 var(--padding);
`;

let LineNumber = styled('span')`
  width: 35px;
  display: inline-block;
`;

let LineContent = styled('span')``;

export let CodeBlock = ({
  lineNumbers = true,
  code,
  language,
  variant = 'bordered'
}: {
  lineNumbers?: boolean;
  code: string;
  language?: string;
  variant?: 'bordered' | 'seamless';
}) => {
  let overflowRef = useRef<HTMLDivElement>(null);
  let scroll = useScroll(overflowRef as any);

  let scrolledLeft = scroll.x > 0;

  return (
    <Wrapper
      style={
        variant == 'bordered'
          ? ({
              border: `1px solid ${theme.colors.gray300}`,
              '--padding': '15px'
            } as any)
          : {}
      }
    >
      <link rel="stylesheet" href="https://fonts.metorial.com/jetbrains-mono.css" />

      <Main>
        <LeftShadow style={{ opacity: scrolledLeft ? 1 : 0 }} />

        <Overflow ref={overflowRef}>
          <Highlight theme={prismTheme} code={code} language={language ?? 'typescript'}>
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <Pre style={style} className={className}>
                {tokens.map((line, i) => (
                  <Line key={i} {...getLineProps({ line })}>
                    {lineNumbers && <LineNumber>{i + 1}</LineNumber>}

                    <LineContent>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </LineContent>
                  </Line>
                ))}
              </Pre>
            )}
          </Highlight>

          <RightShadow />
        </Overflow>
      </Main>
    </Wrapper>
  );
};
