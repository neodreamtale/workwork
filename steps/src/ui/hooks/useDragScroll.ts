import { useRef } from "react";

interface UseDragScrollProps<T> {
  items: T[];
  onReorder: (newItems: T[]) => void;
}

export function useDragScroll<T>({ items, onReorder }: UseDragScrollProps<T>) {
  const dragItemIndex = useRef<number | null>(null);
  const dragOverItemIndex = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const scrollSpeedRef = useRef<number>(0);

  const handleDragStart = (index: number) => {
    dragItemIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverItemIndex.current = index;

    // --- 自动滚动算法 ---
    const threshold = 120;
    const maxSpeed = 25;
    const { clientY } = e;
    const { innerHeight } = window;

    if (clientY < threshold) {
      scrollSpeedRef.current = -Math.max(5, (1 - clientY / threshold) * maxSpeed);
      startAutoScroll();
    } else if (clientY > innerHeight - threshold) {
      const dist = innerHeight - clientY;
      scrollSpeedRef.current = Math.max(5, (1 - dist / threshold) * maxSpeed);
      startAutoScroll();
    } else {
      scrollSpeedRef.current = 0;
    }
  };

  const startAutoScroll = () => {
    if (scrollRafRef.current) return;
    const scroll = () => {
      if (scrollSpeedRef.current !== 0) {
        window.scrollBy(0, scrollSpeedRef.current);
        scrollRafRef.current = requestAnimationFrame(scroll);
      } else {
        scrollRafRef.current = null;
      }
    };
    scrollRafRef.current = requestAnimationFrame(scroll);
  };

  const stopAutoScroll = () => {
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
    scrollSpeedRef.current = 0;
  };


  const handleDragEnd = () => {
    stopAutoScroll();
    if (
      dragItemIndex.current !== null &&
      dragOverItemIndex.current !== null &&
      dragItemIndex.current !== dragOverItemIndex.current
    ) {
      const newItems = [...items];
      const [draggedItem] = newItems.splice(dragItemIndex.current, 1);
      newItems.splice(dragOverItemIndex.current, 0, draggedItem);
      onReorder(newItems);
    }
    dragItemIndex.current = null;
    dragOverItemIndex.current = null;
  };

  return {
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
