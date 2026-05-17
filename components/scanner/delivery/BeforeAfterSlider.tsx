'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface Props {
  beforeSrc: string;
  afterSrc: string;
  afterFilter?: string;
  defaultPos?: number;
  showLabels?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  afterFilter,
  defaultPos = 55,
  showLabels = true,
  className = '',
  style,
}: Props) {
  const [pos, setPos] = useState(defaultPos);
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef(false);

  useEffect(() => {
    setPos(defaultPos);
  }, [afterSrc, beforeSrc, defaultPos]);

  const move = (x: number) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100)));
  };

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden select-none touch-none ${className}`}
      style={style}
      onMouseDown={(e) => { dragRef.current = true; move(e.clientX); }}
      onMouseMove={(e) => { if (dragRef.current) move(e.clientX); }}
      onMouseUp={() => { dragRef.current = false; }}
      onMouseLeave={() => { dragRef.current = false; }}
      onTouchStart={(e) => { dragRef.current = true; move(e.touches[0].clientX); }}
      onTouchMove={(e) => { if (dragRef.current) move(e.touches[0].clientX); }}
      onTouchEnd={() => { dragRef.current = false; }}
    >
      <img
        src={afterSrc}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={afterFilter ? { filter: afterFilter } : undefined}
        draggable={false}
      />
      <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img
          src={beforeSrc}
          alt=""
          className="absolute inset-y-0 left-0 h-full object-cover"
          style={{ width: `${(100 / Math.max(0.5, pos)) * 100}%`, maxWidth: 'none' }}
          draggable={false}
        />
      </div>

      {showLabels && (
        <>
          <div
            className="absolute top-3 left-3 px-2.5 py-1 rounded-pill text-[11px] font-bold text-white backdrop-blur-md transition-opacity"
            style={{ background: 'rgba(0,0,0,0.6)', opacity: pos > 8 ? 1 : 0 }}
          >
            BEFORE
          </div>
          <div
            className="absolute top-3 right-3 px-2.5 py-1 rounded-pill text-[11px] font-bold text-white bg-rausch flex items-center gap-1 transition-opacity"
            style={{ opacity: pos < 92 ? 1 : 0 }}
          >
            <Sparkles className="size-3" /> AFTER
          </div>
        </>
      )}

      <div
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{
          left: `calc(${pos}% - 1.5px)`,
          width: 3,
          background: '#fff',
          boxShadow: '0 0 14px rgba(0,0,0,0.4)',
        }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-11 rounded-full grid place-items-center bg-canvas"
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
        >
          <div className="flex">
            <ChevronLeft className="size-3.5 text-ink" />
            <ChevronRight className="size-3.5 -ml-1 text-ink" />
          </div>
        </div>
      </div>
    </div>
  );
}
