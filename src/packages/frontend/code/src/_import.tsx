import { theme } from '@metorial/ui';
// import { Highlight, Prism } from 'prism-react-renderer';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useScroll } from 'react-use';
import { styled } from 'styled-components';
import prismTheme from './theme';

let Wrapper = styled('div')`
  overflow: hidden;
  background: white;

  &[data-variant='bordered'] {
    border: 1px solid ${theme.colors.gray300};
    border-radius: 10px;
    --padding: 15px;
  }

  &[data-variant='seamless'] {
    --padding: 0px;
    width: 100%;
    height: 100%;
  }
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

let PrismPromise = import('prism-react-renderer');
let CachedPrism: Awaited<typeof PrismPromise> | null = null;

let useHighlight = () => {
  let [Highlight, setHighlight] = useState<Awaited<typeof PrismPromise> | null>(
    () => CachedPrism
  );

  useLayoutEffect(() => {
    PrismPromise.then(Prism => {
      setHighlight(Prism);
      CachedPrism = Prism;

      // @ts-ignore
      (typeof global != 'undefined' ? global : window).Prism = Prism.Prism;
    });
  }, []);

  return Highlight?.Highlight;
};

export let CodeBlock = ({
  lineNumbers = true,
  code,
  language,
  variant = 'bordered',
  replacements = {},
  padding
}: {
  lineNumbers?: boolean;
  code: string;
  language?: string;
  variant?: 'bordered' | 'seamless';
  replacements?: Record<string, () => React.ReactNode>;
  padding?: string;
}) => {
  let overflowRef = useRef<HTMLDivElement>(null);
  let scroll = useScroll(overflowRef as any);

  let scrolledLeft = scroll.x > 0;

  let replacementsRef = useRef(replacements);
  replacementsRef.current = replacements;

  let replacementKeys = Object.keys(replacementsRef.current);

  let Highlight = useHighlight();

  let inner = useMemo(
    () => (
      <Wrapper
        style={
          {
            '--padding': padding
          } as any
        }
        data-variant={variant}
      >
        <link rel="stylesheet" href="https://fonts.metorial.com/jetbrains-mono.css" />

        <Main>
          <LeftShadow style={{ opacity: scrolledLeft ? 1 : 0 }} />

          <Overflow ref={overflowRef}>
            {Highlight && (
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
            )}

            <Pre
              className="language-typescript"
              style={{
                transition: 'all 0.3s ease',

                ...(Highlight
                  ? {
                      opacity: 0,
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                      zIndex: 1
                    }
                  : {})
              }}
            >
              {code.split('\n').map((line, i) => (
                <Line key={i}>
                  {lineNumbers && <LineNumber>{i + 1}</LineNumber>}

                  <LineContent>{line}</LineContent>
                </Line>
              ))}
            </Pre>

            <RightShadow />
          </Overflow>
        </Main>
      </Wrapper>
    ),
    [scrolledLeft, code, language, lineNumbers, variant, Highlight]
  );

  return inner;
};
