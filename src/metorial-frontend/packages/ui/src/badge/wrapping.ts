import React from 'react';
import { css } from 'styled-components';

let maxSingleLineCharacters = 40;

let getLabelLength = (children: React.ReactNode): number => {
  try {
    let length = 0;

    React.Children.forEach(children, child => {
      if (typeof child == 'string' || typeof child == 'number' || typeof child == 'bigint') {
        length += Array.from(String(child)).length;
      } else if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
        length += getLabelLength(child.props.children);
      }
    });

    return length;
  } catch (error) {
    console.error('Error calculating label length:', error);
    return 0;
  }
};

export let canWrapBadgeLabel = (children: React.ReactNode) =>
  getLabelLength(children) > maxSingleLineCharacters;

export let badgeWrapStyles = css<{ $wrap: boolean }>`
  white-space: ${({ $wrap }) => ($wrap ? 'normal' : 'nowrap')};
  overflow-wrap: ${({ $wrap }) => ($wrap ? 'anywhere' : 'normal')};
`;
