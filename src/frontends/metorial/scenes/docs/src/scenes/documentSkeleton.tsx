import type { ComponentProps } from 'react';
import { useMemo, useState } from 'react';
import styled, { ThemeProvider } from 'styled-components';
import { EditorContent, EditorScroll } from '../editor/EditorStyles';
import { DocsStyles } from '../styles/GlobalStyles';
import { lightTheme } from '../styles/theme';

export let Shell = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: ${({ theme }) => theme.color.bg};
  color: ${({ theme }) => theme.color.text};
  font-family: ${({ theme }) => theme.font.sans};
  line-height: 1.6;
`;

export let Main = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

let SkeletonBlockBase = styled.div<{ $width?: string; $height?: string; $radius?: string }>`
  width: ${({ $width }) => $width ?? '100%'};
  height: ${({ $height }) => $height ?? '14px'};
  border-radius: ${({ $radius }) => $radius ?? '999px'};
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.color.bgAlt} 0%,
    ${({ theme }) => theme.color.bgHover} 48%,
    ${({ theme }) => theme.color.bgAlt} 100%
  );
  background-size: 220% 100%;
  animation: docsSkeletonPulse 1.4s ease-in-out infinite;

  @keyframes docsSkeletonPulse {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: -100% 0;
    }
  }
`;

let PULSE_MS = 1400;

export let SkeletonBlock = (p: ComponentProps<typeof SkeletonBlockBase>) => {
  let [delay] = useState(() => `-${Math.round(performance.now() % PULSE_MS)}ms`);
  return <SkeletonBlockBase {...p} style={{ animationDelay: delay, ...p.style }} />;
};

export let SkeletonHeaderButton = styled(SkeletonBlock)`
  flex: 0 0 auto;
`;

export let SkeletonEditorScroll = styled(EditorScroll)`
  overflow: hidden;
`;

export let SkeletonTitle = styled(SkeletonBlock)`
  margin-bottom: 24px;
`;

export let SkeletonStatusBar = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 24px;
  margin: 0 0 25px;
`;

export let SkeletonParagraph = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 6px 0 22px;
`;

export let SkeletonHeading = styled(SkeletonBlock)`
  margin: 34px 0 14px;
`;

export let DocumentSkeletonContent = () => (
  <SkeletonEditorScroll>
    <EditorContent>
      <SkeletonTitle $width="52%" $height="48px" $radius="10px" />
      <SkeletonStatusBar>
        <SkeletonBlock $width="92px" $height="24px" $radius="8px" />
        <SkeletonBlock $width="128px" $height="24px" $radius="8px" />
        <SkeletonBlock $width="112px" $height="24px" $radius="8px" />
        <SkeletonBlock $width="138px" $height="24px" $radius="8px" />
      </SkeletonStatusBar>

      <SkeletonParagraph>
        <SkeletonBlock $width="94%" $height="16px" $radius="5px" />
        <SkeletonBlock $width="89%" $height="16px" $radius="5px" />
        <SkeletonBlock $width="96%" $height="16px" $radius="5px" />
        <SkeletonBlock $width="72%" $height="16px" $radius="5px" />
      </SkeletonParagraph>

      <SkeletonHeading $width="34%" $height="26px" $radius="7px" />
      <SkeletonParagraph>
        <SkeletonBlock $width="91%" $height="16px" $radius="5px" />
        <SkeletonBlock $width="84%" $height="16px" $radius="5px" />
        <SkeletonBlock $width="62%" $height="16px" $radius="5px" />
      </SkeletonParagraph>
    </EditorContent>
  </SkeletonEditorScroll>
);

export let DocumentSkeleton = () => {
  let theme = useMemo(() => lightTheme, []);

  return (
    <ThemeProvider theme={theme}>
      <DocsStyles>
        <Shell>
          <Main>
            <DocumentSkeletonContent />
          </Main>
        </Shell>
      </DocsStyles>
    </ThemeProvider>
  );
};
