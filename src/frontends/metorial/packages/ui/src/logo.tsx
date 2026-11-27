import React from 'react';

export let Logo = ({
  size = 30,
  color = '#0099FF'
}: {
  size?: number | string;
  color?: string;
}) => {
  return (
    <svg
      height={size}
      width={size}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M28.12 0L50 44.24L44 56L28.12 21L11.88 56L6 44.24L28.12 0Z" fill={color} />
    </svg>
  );
};

export let CenteredLogo = ({ size }: { size?: number | string }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Logo size={size} />
    </div>
  );
};
