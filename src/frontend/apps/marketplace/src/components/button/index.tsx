'use client';

import React from 'react';
import { styled } from 'styled-components';

let sizes = {
  '1': {
    padding: '0px 10px',
    height: '26px',
    'font-size': '12px',
    'font-weight': '500',
    'border-radius': '5px'
  },
  '2': {
    padding: '0px 15px',
    height: '30px',
    'font-size': '14px',
    'font-weight': '500',
    'border-radius': '7px'
  },
  '3': {
    padding: '0px 20px',
    height: '36px',
    'font-size': '16px',
    'font-weight': '500',
    'border-radius': '8px'
  },
  '4': {
    padding: '0px 25px',
    height: '40px',
    'font-size': '18px',
    'font-weight': '500',
    'border-radius': '10px'
  },
  '5': {
    padding: '0px 30px',
    height: '46px',
    'font-size': '20px',
    'font-weight': '500',
    'border-radius': '12px'
  }
};

let variants = {
  primary: {
    normal: {
      background: 'linear-gradient(90deg, #000 0%, #333 100%)',
      color: '#eee',
      'box-shadow': '0px 2px 4px rgba(0, 0, 0, 0.1)'
    },
    focus: {
      background: 'linear-gradient(90deg, #222 0%, #555 100%)',
      color: '#fff',
      'box-shadow': '0px 2px 10px rgba(0, 0, 0, 0.15)',
      transform: 'scale(1.05)'
    },
    active: {
      transform: 'scale(0.95)'
    }
  },

  white: {
    normal: {
      background: 'linear-gradient(90deg, #fff 0%, #eee 100%)',
      color: '#333'
    },
    focus: {
      background: 'linear-gradient(90deg, #eee 0%, #ddd 100%)',
      color: '#333',
      transform: 'scale(1.05)'
    },
    active: {
      transform: 'scale(0.95)'
    }
  },

  soft: {
    normal: {
      background: 'linear-gradient(90deg, #ddd 0%, #eee 100%)',
      color: '#333'
    },
    focus: {
      background: 'linear-gradient(90deg, #ccc 0%, #ddd 100%)',
      color: '#333',
      transform: 'scale(1.05)'
    },
    active: {
      transform: 'scale(0.95)'
    }
  },

  outline: {
    normal: {
      background: 'transparent',
      color: '#333',
      border: '1px solid #333'
    },
    focus: {
      background: 'transparent',
      color: '#333',
      border: '1px solid #555',
      transform: 'scale(1.05)'
    },
    active: {
      transform: 'scale(0.95)'
    }
  }
};

let Text = styled.span``;

let Icon = styled.span`
  display: flex;
  height: 100%;
  align-items: center;

  svg {
    height: 50%;
  }
`;

let Wrapper = styled.button.withConfig({
  shouldForwardProp: prop => !['rounded', 'size', 'variant', 'noPadding', 'as'].includes(prop)
})<{
  rounded: 'square' | 'soft' | 'full';
  size: keyof typeof sizes;
  variant: keyof typeof variants;
  noPadding: boolean;
}>`
  outline: none;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  position: relative;
  overflow: hidden;

  padding: ${props => (props.noPadding ? '0px' : sizes[props.size].padding)};
  height: ${props => sizes[props.size].height};
  min-width: ${props => sizes[props.size].height};
  font-size: ${props => sizes[props.size]['font-size']};
  font-weight: ${props => sizes[props.size]['font-weight']};
  border-radius: ${props =>
    props.rounded === 'full' ? '999px' : sizes[props.size]['border-radius']};

  color: ${props => variants[props.variant].normal.color};
  box-shadow: ${props => (variants[props.variant] as any).normal['box-shadow']};

  transition: all 0.2s;

  .bg {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: inherit;
    transition: all 0.5s ease-out;
    transform: scale(5);
    opacity: 0;
    z-index: auto;
  }

  .bg-normal {
    transform: scale(1);
    opacity: 1;
  }

  span {
    position: relative;
    z-index: auto;
  }

  &:focus,
  &:hover {
    color: ${props => variants[props.variant].focus.color};
    box-shadow: ${props => (variants[props.variant] as any).focus['box-shadow']};
    background: ${props => variants[props.variant].focus.background};
    transform: ${props => variants[props.variant].focus.transform};

    .bg-focus {
      transform: scale(1);
      opacity: 1;
    }
  }

  &:active {
    transform: ${props => variants[props.variant].active.transform};

    .bg-active {
      transform: scale(1);
      opacity: 1;
    }
  }
`;

export let LandingButton = ({
  variant = 'primary',
  rounded = 'full',
  as,
  size,
  icon,
  children,
  onClick
}: {
  variant?: keyof typeof variants;
  rounded?: 'square' | 'soft' | 'full';
  as?: 'button' | 'span' | 'div';
  size?: keyof typeof sizes;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
}) => {
  let thisVar = variants[variant];

  let noPadding = !!(!children && icon);

  return (
    <Wrapper
      as={as}
      size={size ?? '2'}
      variant={variant}
      rounded={rounded}
      onClick={onClick}
      noPadding={noPadding}
    >
      <div className="bg bg-normal" style={{ background: thisVar.normal.background }}></div>
      <div className="bg bg-focus" style={{ background: thisVar.focus.background }}></div>
      <div
        className="bg bg-active"
        style={{ background: (thisVar.active as any).background }}
      ></div>

      {icon && <Icon>{icon}</Icon>}
      {children && <Text>{children}</Text>}
    </Wrapper>
  );
};
