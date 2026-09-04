import { theme } from '@metorial/ui';
import { RiCloseLine, RiPauseFill, RiPlayFill } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useLocalStorage } from 'react-use';
import styled from 'styled-components';

let EXPLAINER_VISIBILITY_EVENT = 'metorial:explainer-visibility';

declare global {
  interface Window {
    metorialExplainerIds?: Set<string>;
  }
}

let Wrapper = styled(motion.div)`
  position: fixed;
  display: flex;
  padding: 20px;
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.gray400};
  box-shadow: ${theme.shadows.large};
  border-radius: 14px;
  z-index: 150;
  color: ${theme.colors.foreground};
`;

let Inner = styled(motion.div)`
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  height: 100%;
`;

let Header = styled.header`
  max-width: calc(100% - 40px);
`;

let Title = styled.h2`
  color: ${theme.colors.gray700};
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 5px;
`;

let Description = styled.p`
  color: ${theme.colors.gray600};
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 16px;
`;

let VideoPlayer = styled.div`
  position: relative;
  display: flex;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: black;
  border-radius: 12px;
  overflow: hidden;

  &[data-expanded='true'] {
    flex: 1;
    min-height: 0;
    aspect-ratio: auto;
  }

  &:fullscreen {
    width: 100%;
    height: 100%;
    aspect-ratio: auto;
    border-radius: 0;
  }

  &:hover > div,
  &:focus-within > div {
    opacity: 1;
    pointer-events: auto;
  }
`;

let Video = styled.video`
  width: 100%;
  height: 100%;
  object-fit: contain;
  cursor: pointer;
`;

let VideoControls = styled.div`
  position: absolute;
  left: 50%;
  bottom: 15px;
  width: 70%;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 40px;
  padding: 0 12px;
  border-radius: 8px;
  background: black;
  backdrop-filter: blur(8px);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%);
  transition: opacity 150ms ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
`;

let ControlButton = styled.button`
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: white;
  background: transparent;
  border: 0;
  cursor: pointer;
`;

let Timestamp = styled.span`
  flex: none;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.9);
`;

let Progress = styled.input`
  flex: 1;
  min-width: 0;
  accent-color: white;
`;

let CloseButton = styled(motion.button)`
  position: absolute;
  top: -18px;
  right: -18px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  color: ${theme.colors.gray700};
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.gray300};
  border-radius: 999px;
  box-shadow: ${theme.shadows.medium};
  cursor: pointer;

  &:hover {
    color: ${theme.colors.foreground};
    border-color: ${theme.colors.gray400};
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

let closeVariants = {
  rest: {
    opacity: 0,
    y: 6,
    scale: 0.86,
    pointerEvents: 'none' as const
  },
  hover: {
    opacity: 1,
    y: 0,
    scale: 1,
    pointerEvents: 'auto' as const
  }
};

let formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00';

  let minutes = Math.floor(seconds / 60);
  let remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export let ExplainerVideoPlayer = (p: {
  src: string;
  expanded?: boolean;
  expandOnClick?: boolean;
  onPlay?: () => void;
}) => {
  let [isPlaying, setIsPlaying] = useState(false);
  let [currentTime, setCurrentTime] = useState(0);
  let [duration, setDuration] = useState(0);
  let playerRef = useRef<HTMLDivElement>(null);
  let videoRef = useRef<HTMLVideoElement>(null);

  let togglePlayback = async () => {
    let video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  };

  let expand = () => {
    if (p.expandOnClick && !document.fullscreenElement) {
      let requestFullscreen = playerRef.current?.requestFullscreen();
      if (requestFullscreen) void requestFullscreen.catch(() => undefined);
    }
  };

  let handlePlaybackClick = async () => {
    expand();
    await togglePlayback();
  };

  return (
    <VideoPlayer ref={playerRef} data-expanded={p.expanded}>
      <Video
        ref={videoRef}
        src={p.src}
        playsInline
        onClick={handlePlaybackClick}
        onPlay={() => {
          setIsPlaying(true);
          p.onPlay?.();
        }}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={event => setDuration(event.currentTarget.duration)}
        onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
      />

      <VideoControls onClick={event => event.stopPropagation()}>
        <ControlButton
          type="button"
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
          onClick={handlePlaybackClick}
        >
          {isPlaying ? <RiPauseFill size={18} /> : <RiPlayFill size={18} />}
        </ControlButton>
        <Timestamp>{formatTime(currentTime)}</Timestamp>
        <Progress
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={currentTime}
          aria-label="Video progress"
          onChange={event => {
            let video = videoRef.current;
            if (!video) return;

            video.currentTime = Number(event.target.value);
            setCurrentTime(video.currentTime);
          }}
        />
        <Timestamp>{formatTime(duration)}</Timestamp>
      </VideoControls>
    </VideoPlayer>
  );
};

export let Explainer = (p: {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
}) => {
  let [isOpen, setIsOpen] = useLocalStorage(`explainer-${p.id}`, true);
  let [isExpanded, setIsExpanded] = useState(false);
  let [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let explainerIds = (window.metorialExplainerIds ||= new Set());
    explainerIds.add(p.id);
    window.dispatchEvent(new CustomEvent(EXPLAINER_VISIBILITY_EVENT));

    return () => {
      explainerIds.delete(p.id);
      window.dispatchEvent(new CustomEvent(EXPLAINER_VISIBILITY_EVENT));
    };
  }, [isOpen, p.id]);

  return (
    <AnimatePresence>
      {isOpen && (
        <Wrapper
          layout
          style={
            isExpanded
              ? {
                  width: '90vw',
                  height: '90vh',
                  top: '5vh',
                  left: '5vw'
                }
              : {
                  width: 'min(320px, calc(100vw - 36px))',
                  bottom: 'calc(var(--metorial-product-shell-height, 0px) + 15px)',
                  right: 15
                }
          }
          initial={{
            opacity: 0,
            y: 50,
            filter: 'blur(10px)'
          }}
          animate={{
            opacity: 1,
            y: 0,
            filter: 'blur(0px)'
          }}
          exit={{ opacity: 0, y: 50, filter: 'blur(10px)' }}
          transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.4 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
        >
          <CloseButton
            type="button"
            aria-label="Close explainer"
            initial="rest"
            animate={isHovered || isExpanded ? 'hover' : 'rest'}
            variants={closeVariants}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onClick={() => setIsOpen(false)}
          >
            <RiCloseLine />
          </CloseButton>

          <Inner
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 100, damping: 20 }}
          >
            <Header>
              <Title>{p.title}</Title>
              <Description>{p.description}</Description>
            </Header>

            <ExplainerVideoPlayer
              src={p.videoUrl}
              expanded={isExpanded}
              onPlay={() => setIsExpanded(true)}
            />
          </Inner>
        </Wrapper>
      )}
    </AnimatePresence>
  );
};
