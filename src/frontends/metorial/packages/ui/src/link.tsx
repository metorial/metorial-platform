import React from 'react';

type ILink = (props: {
  to: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => React.ReactNode;

let defaultLink: ILink = ({ to, children, className, style }) => {
  return (
    <a href={to} className={className} style={style}>
      {children}
    </a>
  );
};

export let getLink = () => {
  let linkFromWindow =
    typeof window !== 'undefined' ? (window as any).LinkComponent : undefined;
  let linkFromGlobal =
    typeof global !== 'undefined' ? (global as any).LinkComponent : undefined;

  return linkFromWindow ?? linkFromGlobal ?? defaultLink;
};
