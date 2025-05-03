import React, { useRef, useState } from 'react';
import { useInterval } from 'react-use';
import { theme } from '../theme';
import { Tooltip } from '../tooltip';

let loadedSet = new Set<string>();

export let Avatar = ({
  entity,
  size = 30,
  noTooltip,
  withInitials
}: {
  entity: {
    name: string;
    photoUrl?: string | undefined | null;
    imageUrl?: string | undefined | null;
  } | null;
  size?: number;
  noTooltip?: boolean;
  withInitials?: boolean;
}) => {
  let src = entity?.photoUrl || entity?.imageUrl!;
  let name = entity?.name;
  let ref = useRef<HTMLImageElement>(null);

  let [loaded, setLoaded] = useState(() => loadedSet.has(src));

  useInterval(() => {
    if (loaded || !ref.current) return;

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
        borderRadius: '50%',
        backgroundColor: theme.colors.gray200,
        display: 'flex',
        position: 'relative'
      }}
    >
      {src && (
        <img
          src={src}
          alt={name}
          ref={ref}
          style={{
            width: size,
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.2s'
          }}
          onLoad={() => {
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
