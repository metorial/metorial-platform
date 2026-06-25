import React, { useRef, useState } from 'react';
import { useInterval } from 'react-use';
import { Tooltip } from '../tooltip';

let loadedSet = new Set<string>();

export let Avatar = ({
  entity,
  size = 30,
  noTooltip,
  withInitials,
  radius,
  imageFit = 'cover'
}: {
  entity: {
    name: string;
    photoUrl?: string | undefined | null;
    imageUrl?: string | undefined | null;
  } | null;
  size?: number;
  noTooltip?: boolean;
  withInitials?: boolean;
  radius?: number | 'round';
  imageFit?: 'cover' | 'contain';
}) => {
  let src = entity?.photoUrl || entity?.imageUrl;
  let name = entity?.name;
  let ref = useRef<HTMLImageElement>(null);

  let [loaded, setLoaded] = useState(() => (src ? loadedSet.has(src) : false));

  useInterval(() => {
    if (loaded || !ref.current || !src) return;

    if (ref.current.complete) {
      setLoaded(true);
      loadedSet.add(src);
    }
  }, 100);

  let initials = name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  let inner = (
    <div
      style={{
        width: size,
        aspectRatio: '1 / 1',
        borderRadius: typeof radius == 'number' ? radius : '50%',
        // backgroundColor: theme.colors.gray200,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {src && (
        <img
          src={src}
          alt={name}
          ref={ref}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: typeof radius == 'number' ? radius : '50%',
            objectFit: imageFit,
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.2s',
            display: 'block'
          }}
          onLoad={() => {
            if (!src) return;
            setLoaded(true);
            loadedSet.add(src);
          }}
        />
      )}

      {initials && withInitials && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: 'white',
            fontSize: size / 2.5,
            fontWeight: 700,
            userSelect: 'none',
            textShadow: '0 0 4px rgba(0, 0, 0, 0.7)'
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );

  if (noTooltip) return inner;

  return <Tooltip content={name}>{inner}</Tooltip>;
};
