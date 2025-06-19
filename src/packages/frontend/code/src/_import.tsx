import { theme } from '@metorial/ui';
import { Highlight, Prism } from 'prism-react-renderer';
import React, { useMemo, useRef } from 'react';
import { useScroll } from 'react-use';
import { styled } from 'styled-components';
import prismTheme from './theme';

(typeof global != 'undefined' ? global : window).Prism = Prism;

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
  user-select: none;
`;

let LineContent = styled('span')``;

export let CodeBlock = ({
  lineNumbers = true,
  code,
  language,
  variant = 'bordered',
  replacements = {}
}: {
  lineNumbers?: boolean;
  code: string;
  language?: string;
  variant?: 'bordered' | 'seamless';
  replacements?: Record<string, () => React.ReactNode>;
}) => {
  let overflowRef = useRef<HTMLDivElement>(null);
  let scroll = useScroll(overflowRef as any);

  let scrolledLeft = scroll.x > 0;

  let replacementsRef = useRef(replacements);
  replacementsRef.current = replacements;

  let replacementKeys = Object.keys(replacementsRef.current);

  let inner = useMemo(
    () => (
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
              {({ className, style, tokens: lines, getLineProps, getTokenProps }) => (
                <Pre style={style} className={className}>
                  {lines.map((lineTokens, i) => (
                    <Line key={i} {...getLineProps({ line: lineTokens })}>
                      {lineNumbers && <LineNumber>{i + 1}</LineNumber>}

                      <LineContent>
                        {lineTokens.map((token, key) => {
                          let tokenProps = getTokenProps({ token });

                          let children: React.ReactNode = tokenProps.children;

                          let replacementKey = replacementKeys.find(key =>
                            token.content.includes(key)
                          );
                          if (replacementKey) {
                            let [before, after] = token.content.split(replacementKey);
                            children = (
                              <>
                                {before}
                                {replacementsRef.current[replacementKey]()}
                                {after}
                              </>
                            );
                          }

                          return (
                            <span key={key} {...tokenProps}>
                              {children}
                            </span>
                          );
                        })}
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
    ),
    [scrolledLeft, code, language, lineNumbers, variant]
  );

  return inner;
};
