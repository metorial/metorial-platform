'use client';

import { IconArrowNarrowLeft, IconArrowNarrowRight } from '@tabler/icons-react';
import { motion } from 'motion/react';
import { ImageProps } from 'next/image';
import Link from 'next/link';
import React, { createContext, JSX, useEffect, useState } from 'react';
import styled from 'styled-components';
import { cn } from '../lib/utils';

type Card = {
  src: string;
  title: string;
  category?: string;
};

export let CarouselContext = createContext<{
  onCardClose: (index: number) => void;
  currentIndex: number;
}>({
  onCardClose: () => {},
  currentIndex: 0
});

let CarouselWrapper = styled.div`
  position: relative;
  width: 100%;
`;

let CarouselContainer = styled.div`
  display: flex;
  width: 100%;
  overflow-x: scroll;
  overscroll-behavior-x: auto;
  scroll-behavior: smooth;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

let CarouselFade = styled.div`
  position: absolute;
  right: 0;
  z-index: 1000;
  height: auto;
  width: 5%;
  overflow: hidden;
  background-image: linear-gradient(to left, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0));
`;

let CarouselItems = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  gap: 1rem;
  padding-left: 1rem;
  margin-left: auto;
  margin-right: auto;
  max-width: 80rem;
`;

let CarouselItem = styled(motion.div)`
  border-radius: 1.5rem;
  &:last-child {
    padding-right: 5%;
  }
  @media (min-width: 768px) {
    &:last-child {
      padding-right: 33%;
    }
  }
`;

let CarouselControls = styled.div`
  margin-top: 1.25rem;
  margin-right: 2.5rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  position: absolute;
  top: -80px;
  right: 0;

  @media (max-width: 768px) {
    display: none;
  }
`;

let NavButton = styled.button`
  position: relative;
  z-index: 40;
  display: flex;
  height: 2.5rem;
  width: 2.5rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background-color: #ddd;

  &:disabled {
    opacity: 0.5;
  }
`;

let CardButton = styled(Link)`
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  overflow: hidden;
  background-color: #ddd;
  height: 20rem;
  width: 400px;
  border-radius: 5px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.25);
  margin: 10px 0px;

  @media (min-width: 768px) {
    margin: 30px 0px;
    height: 30rem;
    width: 24rem;
    background-color: #333;
  }
`;

let CardContent = styled.div`
  position: relative;
  z-index: 40;
  padding: 5rem 2rem 2rem 2rem;
  width: 100%;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.6) 100%);
`;

let CardCategory = styled(motion.p)`
  text-align: left;
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  @media (min-width: 768px) {
    font-size: 1rem;
  }
`;

let CardTitle = styled(motion.p)`
  margin-top: 0.5rem;
  max-width: 20rem;
  text-align: left;
  font-size: 1.25rem;
  font-weight: 600;
  text-wrap: balance;
  color: white;

  @media (min-width: 768px) {
    font-size: 1.875rem;
  }
`;

let StyledBlurImage = styled.img`
  height: 100%;
  width: 100%;
  transition: all 300ms;
  object-fit: cover;
  position: absolute;
  inset: 0;
  z-index: 10;
`;

export let Carousel = ({
  items,
  initialScroll = 0
}: {
  items: JSX.Element[];
  initialScroll?: number;
}) => {
  let carouselRef = React.useRef<HTMLDivElement>(null);
  let [canScrollLeft, setCanScrollLeft] = React.useState(false);
  let [canScrollRight, setCanScrollRight] = React.useState(true);
  let [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (carouselRef.current) {
      carouselRef.current.scrollLeft = initialScroll;
      checkScrollability();
    }
  }, [initialScroll]);

  let checkScrollability = () => {
    if (carouselRef.current) {
      let { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
    }
  };

  let scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  let scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  let handleCardClose = (index: number) => {
    if (carouselRef.current) {
      let cardWidth = isMobile() ? 230 : 384; // (md:w-96)
      let gap = isMobile() ? 4 : 8;
      let scrollPosition = (cardWidth + gap) * (index + 1);
      carouselRef.current.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
      setCurrentIndex(index);
    }
  };

  let isMobile = () => {
    return window && window.innerWidth < 768;
  };

  return (
    <CarouselContext.Provider value={{ onCardClose: handleCardClose, currentIndex }}>
      <CarouselWrapper>
        <CarouselContainer ref={carouselRef} onScroll={checkScrollability}>
          <CarouselFade />
          <CarouselItems>
            {items.map((item, index) => (
              <CarouselItem
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.5,
                    delay: 0.2 * index,
                    ease: 'easeOut'
                    // once: true
                  }
                }}
                key={'card' + index}
              >
                {item}
              </CarouselItem>
            ))}
          </CarouselItems>
        </CarouselContainer>
        <CarouselControls>
          <NavButton onClick={scrollLeft} disabled={!canScrollLeft}>
            <IconArrowNarrowLeft className="h-6 w-6 text-gray-500" />
          </NavButton>
          <NavButton onClick={scrollRight} disabled={!canScrollRight}>
            <IconArrowNarrowRight className="h-6 w-6 text-gray-500" />
          </NavButton>
        </CarouselControls>
      </CarouselWrapper>
    </CarouselContext.Provider>
  );
};

export let Card = ({
  card,
  index,
  href,
  layout = false
}: {
  card: Card;
  index: number;
  layout?: boolean;
  href: string;
}) => {
  return (
    <CardButton href={href} prefetch={false}>
      <CardContent>
        {card.category && (
          <CardCategory layoutId={layout ? `category-${card.category}` : undefined}>
            {card.category}
          </CardCategory>
        )}
        <CardTitle layoutId={layout ? `title-${card.title}` : undefined}>
          {card.title}
        </CardTitle>
      </CardContent>
      <BlurImage src={card.src} alt={card.title} className="" />
    </CardButton>
  );
};

export let BlurImage = ({ height, width, src, className, alt, ...rest }: ImageProps) => {
  return (
    <StyledBlurImage
      className={cn(className)}
      src={src as string}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      alt={alt}
      {...rest}
    />
  );
};
