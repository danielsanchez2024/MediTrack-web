import { useRef, useState, type PointerEvent } from 'react';
import type { CropRect } from '../../lib/imageCrop';

interface PrescriptionCropperProps {
  src: string;
  value: CropRect | null;
  onChange: (rect: CropRect | null) => void;
}

// Selections smaller than this (as a fraction of the image) are treated as a stray tap, not a crop.
const MIN_SIZE = 0.05;

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// Drag over the photo to frame only the medication lines. Works with mouse and touch (pointer
// events); the rectangle is stored as fractions of the image so it survives any preview size.
export default function PrescriptionCropper({ src, value, onChange }: PrescriptionCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  function pointFrom(event: PointerEvent<HTMLDivElement>) {
    const box = containerRef.current!.getBoundingClientRect();
    return { x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height) };
  }

  function handleDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setAnchor(pointFrom(event));
    onChange(null);
  }

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    if (!anchor) return;
    const point = pointFrom(event);
    onChange({
      x: Math.min(anchor.x, point.x),
      y: Math.min(anchor.y, point.y),
      width: Math.abs(point.x - anchor.x),
      height: Math.abs(point.y - anchor.y)
    });
  }

  function handleUp() {
    setAnchor(null);
    if (value && (value.width < MIN_SIZE || value.height < MIN_SIZE)) onChange(null);
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      className="relative mx-auto w-fit max-w-full cursor-crosshair select-none overflow-hidden rounded-xl border border-border"
      style={{ touchAction: 'none' }}
    >
      <img src={src} alt="Foto de la fórmula" draggable={false} className="block max-h-80 w-auto max-w-full" />
      {value && (
        <div
          aria-label="Zona seleccionada"
          className="pointer-events-none absolute border-2 border-primary"
          style={{
            left: `${value.x * 100}%`,
            top: `${value.y * 100}%`,
            width: `${value.width * 100}%`,
            height: `${value.height * 100}%`,
            // Dims everything outside the selection: what stays bright is what will be sent.
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
          }}
        />
      )}
    </div>
  );
}
