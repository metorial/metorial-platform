import { Skeleton, theme } from '@metorial/ui';
import type { CSSProperties } from 'react';
import styled from 'styled-components';

export let SkeletonBar = (p: {
  width: number | string;
  height?: number;
  radius?: number;
  style?: CSSProperties;
}) => (
  <Skeleton
    active
    borderRadius={p.radius ?? 5}
    style={{ width: p.width, height: p.height ?? 12, ...p.style }}
  >
    <span />
  </Skeleton>
);

// Occupies exactly the line box of a `Text` of the same size, so a bar standing in for
// a line of text doesn't move anything once the text arrives.
let textLineHeights: Record<string, { line: number; bar: number }> = {
  '1': { line: 16, bar: 10 },
  '2': { line: 20, bar: 12 },
  '3': { line: 24, bar: 14 }
};

let TextLine = styled.div<{ $line: number }>`
  height: ${p => p.$line}px;
  display: flex;
  align-items: center;
`;

export let SkeletonText = (p: { width: number | string; size?: '1' | '2' | '3' }) => {
  let metrics = textLineHeights[p.size ?? '2'];

  return (
    <TextLine $line={metrics.line}>
      <SkeletonBar width={p.width} height={metrics.bar} />
    </TextLine>
  );
};

let ChannelSection = styled.div`
  padding: 8px 8px 5px;
`;

let ChannelSectionLine = styled.div`
  height: 16px;
  display: flex;
  align-items: center;
`;

let ChannelRow = styled.div`
  padding: 5px 7px;
`;

let ChannelRowLine = styled.div`
  height: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

export let ChannelListSkeleton = ({ rows = 9 }: { rows?: number }) => (
  <>
    {Array.from({ length: rows }).map((_, index) => (
      <ChannelRow key={index}>
        <ChannelRowLine>
          <SkeletonBar width={24} height={24} radius={6} />
          <SkeletonBar width={`${45 + ((index * 17) % 45)}%`} height={12} />
        </ChannelRowLine>
      </ChannelRow>
    ))}
  </>
);

// Mirrors the transcript's day divider and message rows so swapping in real messages
// doesn't move anything.
let MessageDivider = styled.div`
  padding: 12px 20px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

let MessageRow = styled.div`
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 10px;
  padding: 5px 20px;
`;

let MessageGutter = styled.div`
  padding-top: 2px;
`;

let MessageLine = styled.div`
  height: 20px;
  display: flex;
  align-items: center;

  &[data-author='true'] {
    margin-bottom: 2px;
  }
`;

export let MessageListSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <>
    <MessageDivider>
      <SkeletonBar width={86} height={20} radius={11} />
    </MessageDivider>

    {Array.from({ length: rows }).map((_, index) => (
      <MessageRow key={index}>
        <MessageGutter>
          <SkeletonBar width={36} height={36} radius={7} />
        </MessageGutter>

        <div>
          <MessageLine data-author="true">
            <SkeletonBar width={`${18 + ((index * 11) % 16)}%`} height={13} />
          </MessageLine>

          <MessageLine>
            <SkeletonBar width={`${52 + ((index * 23) % 40)}%`} height={13} />
          </MessageLine>

          {index % 3 == 0 && (
            <MessageLine>
              <SkeletonBar width={`${35 + ((index * 13) % 30)}%`} height={13} />
            </MessageLine>
          )}
        </div>
      </MessageRow>
    ))}
  </>
);

let Cards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

let Card = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
`;

let CardLines = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
  flex: 1;
`;

export let ChatCardsSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <Cards>
    {Array.from({ length: rows }).map((_, index) => (
      <Card key={index}>
        <SkeletonBar width={34} height={34} radius={8} />

        <CardLines>
          <SkeletonBar width={`${30 + ((index * 19) % 30)}%`} height={13} />
          <SkeletonBar width={`${45 + ((index * 13) % 25)}%`} height={11} />
        </CardLines>
      </Card>
    ))}
  </Cards>
);
