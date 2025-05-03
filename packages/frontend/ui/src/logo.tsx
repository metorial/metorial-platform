import React from 'react';

export let Logo = ({ size = 30 }: { size?: number | string }) => {
  return (
    <svg
      height={size}
      width={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M49.5 0L89 79L78.5 100H20.5L10 79L49.5 0Z" fill="#3867D6" />
      <path d="M49.5 37L78.5 100H20.5L49.5 37Z" fill="#5FADF4" />
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
