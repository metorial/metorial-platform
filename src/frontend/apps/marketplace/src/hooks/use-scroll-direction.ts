import { useDelayed } from '@looped/hooks';
import { useScroll } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

export let useScrollDirection = () => {
  let { scrollY } = useScroll();
  let [isScrolled, setIsScrolled] = useState(false);
  let delayedScrolled = useDelayed(isScrolled, 100);
  let lastScrollRef = useRef(-1);

  useEffect(
    () =>
      scrollY.on('change', y => {
        if (y > lastScrollRef.current && lastScrollRef.current > 0 && y > 100) {
          setIsScrolled(true);
        } else {
          setIsScrolled(false);
        }

        lastScrollRef.current = y;
      }),
    []
  );

  return {
    isScrolled,
    isScrolledDelayed: delayedScrolled
  };
};
