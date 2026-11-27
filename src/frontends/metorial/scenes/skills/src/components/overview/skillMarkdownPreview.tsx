import { Readme } from '@metorial/markdown';
import { Skeleton, Text, theme } from '@metorial/ui';
import { useEffect, useRef, useState } from 'react';
import { styled } from 'styled-components';

let previewLineLimit = 28;
let previewFontSize = '13px';
let previewOpacity = 0.85;
let previewRootMargin = '300px 0px';

let frontMatterPattern = /^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\r?\n?/;

let Viewport = styled.div`
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding: 14px 16px 0;

  &::after {
    content: '';
    position: absolute;
    inset: auto 0 0 0;
    height: 40px;
    background: linear-gradient(transparent, ${theme.colors.background});
    pointer-events: none;
  }
`;

let Scaled = styled.div`
  width: 200%;
  transform: scale(0.5);
  transform-origin: top left;
  opacity: ${previewOpacity};
  pointer-events: none;
  user-select: none;
`;

let SkeletonLines = styled.div`
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding-top: 4px;
`;

let SkeletonLine = styled.span`
  display: block;
  height: 7px;
`;

let skeletonWidths = ['55%', '92%', '86%', '70%', null, '40%', '88%', '78%', '64%'];

let getPreviewSource = (raw: string) => {
  let body = raw.replace(/^﻿/, '').replace(frontMatterPattern, '');
  let lines = body.replace(/^\s+/, '').split(/\r?\n/).slice(0, previewLineLimit);

  let openFences = lines.filter(line => /^\s*(```|~~~)/.test(line)).length;
  if (openFences % 2 == 1) lines.push('```');

  return lines.join('\n');
};

let useInViewport = <T extends Element>() => {
  let ref = useRef<T>(null);
  let [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    let element = ref.current;
    if (!element || hasEntered) return;

    let observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setHasEntered(true);
          observer.disconnect();
        }
      },
      { rootMargin: previewRootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasEntered]);

  return [ref, hasEntered] as const;
};

let PreviewSkeleton = () => (
  <SkeletonLines>
    {skeletonWidths.map((width, index) =>
      width ? (
        <Skeleton key={index} active borderRadius={4} style={{ display: 'grid', width }}>
          <SkeletonLine />
        </Skeleton>
      ) : (
        <SkeletonLine key={index} />
      )
    )}
  </SkeletonLines>
);

export let SkillMarkdownPreview = (p: { content: string | null | undefined }) => {
  let [ref, isVisible] = useInViewport<HTMLDivElement>();

  return (
    <Viewport ref={ref}>
      {p.content === undefined || !isVisible ? (
        <PreviewSkeleton />
      ) : p.content === null ? (
        <Text size="2" color="gray600">
          No SKILL.md yet
        </Text>
      ) : (
        <Scaled>
          <Readme readme={getPreviewSource(p.content)} fontSize={previewFontSize} />
        </Scaled>
      )}
    </Viewport>
  );
};
