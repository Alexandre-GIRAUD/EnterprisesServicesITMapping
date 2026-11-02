import { useCallback, useEffect, useState, type RefObject } from 'react';

export async function toggleFullscreen(
  element: HTMLElement,
  doc: Document = document
): Promise<void> {
  if (doc.fullscreenElement === element) {
    await doc.exitFullscreen();
    return;
  }
  await element.requestFullscreen();
}

/** Only the full-screen element's subtree is visible, so dialogs must mount inside it. */
export function portalTarget(doc: Document = document): HTMLElement {
  return (doc.fullscreenElement as HTMLElement | null) ?? doc.body;
}

/** Tracks whether `ref` is the full-screen element; calls `onChange` after each enter or exit. */
export function useFullscreen(ref: RefObject<HTMLElement | null>, onChange: () => void) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(document.fullscreenElement === ref.current);
      onChange();
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, [ref, onChange]);

  const toggle = useCallback(() => {
    if (ref.current) void toggleFullscreen(ref.current).catch(() => undefined);
  }, [ref]);

  return { isFullscreen, toggle };
}
