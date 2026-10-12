import { useEffect, useRef, useState } from 'react';

/**
 * Masonry cell for a grid with `auto-rows-[8px] gap-4`: the cell measures its
 * content and spans ceil((height + 16px gap) / 24px) rows, so cards of
 * different heights pack tightly instead of leaving dead space under short
 * cards. DOM order (and drag-to-reorder) is preserved — unlike CSS columns.
 */
export function MasonryCell({
  children,
  style,
  ...divProps
}: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean }) {
  const inner = useRef<HTMLDivElement>(null);
  const [span, setSpan] = useState(1);
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () =>
      setSpan(Math.max(1, Math.ceil((el.getBoundingClientRect().height + 16) / 24)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div {...divProps} style={{ ...style, gridRowEnd: `span ${span}` }}>
      <div ref={inner}>{children}</div>
    </div>
  );
}
