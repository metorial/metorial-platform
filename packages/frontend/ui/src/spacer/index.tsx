import React from 'react';

export let Spacer = ({
  size,
  height,
  width,
  grow,
  shrink = false
}: {
  size?: string | number;
  height?: string | number;
  width?: string | number;
  grow?: boolean;
  shrink?: boolean;
}) => {
  return (
    <div
      style={{
        height: height ?? size,
        width: width ?? size,
        flexGrow: (!height && !width && !size) || grow ? 1 : undefined,
        flexShrink: shrink === false ? 0 : shrink ? 1 : undefined
      }}
    />
  );
};
