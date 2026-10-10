import React, { useEffect, useRef } from 'react';
import { GripVertical, GripHorizontal } from 'lucide-react';

export default function ResizeHandle({ direction = 'horizontal', onResize, onResizeStart, onResizeEnd, label, style }) {
  const startRef = useRef(null);
  const frameRef = useRef(null);
  const latestRef = useRef(null);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const move = (event) => {
    if (!startRef.current) return;
    latestRef.current = direction === 'horizontal'
      ? event.clientX - startRef.current.pointer
      : event.clientY - startRef.current.pointer;
    if (!frameRef.current) {
      frameRef.current = requestAnimationFrame(() => {
        onResize(latestRef.current);
        frameRef.current = null;
      });
    }
  };

  const stop = () => {
    if (!startRef.current) return;
    startRef.current = null;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', stop);
    document.body.classList.remove(direction === 'horizontal' ? 'is-resizing-columns' : 'is-resizing-rows');
    onResizeEnd?.();
  };

  const start = (event) => {
    event.preventDefault();
    startRef.current = { pointer: direction === 'horizontal' ? event.clientX : event.clientY };
    document.body.classList.add(direction === 'horizontal' ? 'is-resizing-columns' : 'is-resizing-rows');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    onResizeStart?.();
  };

  const nudge = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const horizontal = direction === 'horizontal';
    if ((horizontal && event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') || (!horizontal && event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    onResize((event.key === 'ArrowLeft' || event.key === 'ArrowUp') ? -16 : 16);
  };

  const Icon = direction === 'horizontal' ? GripVertical : GripHorizontal;
  return (
    <div
      className={`resize-handle resize-handle-${direction}`}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
      onPointerDown={start}
      onKeyDown={nudge}
      style={style}
    >
      <Icon size={14} aria-hidden="true" />
    </div>
  );
}
