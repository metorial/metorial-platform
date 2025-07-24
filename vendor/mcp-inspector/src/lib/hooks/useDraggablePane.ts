import { useCallback, useEffect, useRef, useState } from 'react';

export function useDraggablePane(initialHeight: number, direction: 'horizontal' | 'vertical') {
  const [height, setHeight] = useState(initialHeight);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      dragStartY.current = direction === 'horizontal' ? e.clientX : e.clientY;
      dragStartHeight.current = height;
      document.body.style.userSelect = 'none';
    },
    [height]
  );

  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = dragStartY.current - (direction === 'horizontal' ? e.clientX : e.clientY);
      const newHeight = Math.max(100, Math.min(800, dragStartHeight.current + deltaY));
      setHeight(newHeight);
    },
    [isDragging]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  return {
    height,
    isDragging,
    handleDragStart
  };
}
