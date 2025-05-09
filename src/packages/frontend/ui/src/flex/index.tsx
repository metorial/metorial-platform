import React from 'react';

export let Flex = ({
  children,
  direction = 'row',
  align,
  justify,
  wrap = 'nowrap',
  gap = 0,
  ...props
}: {
  children: React.ReactNode;
  direction?: 'row' | 'column';
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end';
  wrap?: 'nowrap' | 'wrap';
  gap?: number | string;
} & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      {...props}
      style={{
        display: 'flex',
        flexDirection: direction,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap,
        gap,
        ...props.style
      }}
    >
      {children}
    </div>
  );
};
