import { useEffect, useState } from 'react';

/** Minimal image lightbox: click backdrop or Esc to close, click image to zoom. */
export function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc handled globally above
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black/70 p-8"
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: zoom toggle is a convenience; Esc closes */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => {
          e.stopPropagation();
          setZoom((z) => !z);
        }}
        className={
          zoom
            ? 'max-w-none cursor-zoom-out rounded-lg'
            : 'max-h-full max-w-full cursor-zoom-in rounded-lg object-contain'
        }
      />
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="fixed bottom-5 right-6 rounded-lg bg-card px-3 py-1.5 text-xs text-brand-text shadow-lg"
      >
        Open original
      </a>
    </div>
  );
}
