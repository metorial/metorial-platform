import React, { useMemo, useRef, useState } from 'react';
import { useWindowSize } from 'react-use';
import styled, { keyframes } from 'styled-components';
import { Mark } from './mark';
import { Star } from './star';

let pallet = ['#ffa502', '#2ed573', '#ff7f50', '#1e90ff', '#ff4757'];

let getFirstLineSize = (textNode: Text) => {
  let range = document.createRange();
  range.setStart(textNode, 0); // Start at the beginning of the text node

  // Loop through the text node and extend the range until a newline or a space break is detected
  let endIndex = 0;
  let height = -1;
  while (endIndex < textNode.length) {
    range.setEnd(textNode, endIndex + 1);

    let rect = range.getBoundingClientRect();
    if (height == -1) height = rect.height;

    if (rect.height > height) break;

    endIndex++;
  }

  // Return the width of the first line
  return range.getBoundingClientRect();
};

let flatMapNodes = (node: Node) => {
  let recursive = (node: Node, acc: Node[]): Node[] => {
    acc.push(node);

    for (let child of node.childNodes) {
      recursive(child, acc);
    }

    return acc;
  };

  return recursive(node, []);
};

let Span = styled.span`
  position: relative;
`;

let rotate = keyframes`
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
`;

let StarWrapper = styled.span`
  /* animation: ${rotate} 10s linear infinite; */
`;

export let TextSparkle = ({ children }: { children: React.ReactNode }) => {
  let rootRef = useRef<HTMLDivElement>(null);
  let windowsSize = useWindowSize();

  let firstLineSize = useMemo(() => {
    if (!rootRef.current) return;

    let nodes = flatMapNodes(rootRef.current);
    let textNode = nodes.find(node => node.nodeType == Node.TEXT_NODE) as Text;
    if (!textNode) return;

    return getFirstLineSize(textNode);
  }, [rootRef.current, windowsSize.height, windowsSize.width]);

  let markSize = firstLineSize ? firstLineSize.height * 1.3 : 0;
  let starSize = firstLineSize ? firstLineSize.height * 1.2 : 0;

  let [colors] = useState(() => {
    let color1Index = Math.floor(Math.random() * pallet.length);
    let color2Index = Math.floor(Math.random() * pallet.length);
    while (color1Index == color2Index) {
      color2Index = Math.floor(Math.random() * pallet.length);
    }

    return [pallet[color1Index], pallet[color2Index]] as const;
  });

  return (
    <Span ref={rootRef}>
      {children}

      {firstLineSize && (
        <>
          <span
            style={{ position: 'absolute', top: -(markSize / 1.7), left: -(markSize / 1.2) }}
          >
            <Mark size={markSize} color={colors[0]} />
          </span>

          <StarWrapper
            style={{
              position: 'absolute',
              top: -(starSize / 3),
              left: firstLineSize.width + starSize
            }}
          >
            <Star size={starSize} color={colors[1]} />
          </StarWrapper>
        </>
      )}
    </Span>
  );
};
