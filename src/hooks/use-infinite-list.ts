import { useEffect, useRef, useState } from 'react';

/**
 * Client-side infinite scroll for already-loaded arrays.
 * Slices the input to `count` items and grows `count` by `pageSize`
 * each time the returned sentinel ref enters the viewport.
 * Resets to one page whenever the input array reference changes,
 * so filter/search changes start from the top.
 */
export function useInfiniteList<T>(items: T[], pageSize = 25) {
  const [count, setCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCount(pageSize);
  }, [items, pageSize]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (count >= items.length) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCount(c => Math.min(c + pageSize, items.length));
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [count, items.length, pageSize]);

  const visible = items.slice(0, count);
  return {
    visible,
    sentinelRef,
    hasMore: count < items.length,
    shown: visible.length,
    total: items.length,
  };
}
