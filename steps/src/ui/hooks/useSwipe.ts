import { useState, useRef } from "react";

interface UseSwipeProps {
  limit: number;
}

export function useSwipe({ limit }: UseSwipeProps) {
  const [isSwiping, setIsSwiping] = useState(false);
  const [offsetX, setOffsetX] = useState(0); // 负数代表向左滑
  const [isOpened, setIsOpened] = useState(false);
  const startX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startX.current = x;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isSwiping) return;
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const diff = x - startX.current;

    let newOffset = isOpened ? -limit + diff : diff;

    // 限制范围
    if (newOffset > 0) newOffset = 0;
    if (newOffset < -limit - 20) newOffset = -limit - 20;

    setOffsetX(newOffset);
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (offsetX < -limit / 2) {
      setOffsetX(-limit);
      setIsOpened(true);
    } else {
      setOffsetX(0);
      setIsOpened(false);
    }
  };

  const reset = () => {
    setOffsetX(0);
    setIsOpened(false);
  };

  return {
    isSwiping,
    offsetX,
    isOpened,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    reset
  };
}
