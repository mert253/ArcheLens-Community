import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

interface ImageComparisonProps {
  beforeImage: string;
  afterImage: string;
  labelBefore?: string;
  labelAfter?: string;
}

export const ImageComparison: React.FC<ImageComparisonProps> = ({
  beforeImage,
  afterImage,
  labelBefore = "Orijinal",
  labelAfter = "Restore Edilmiş"
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = (x / rect.width) * 100;
      setSliderPosition(percentage);
    }
  }, []);

  const handleMouseDown = () => setIsDragging(true);
  const handleTouchStart = () => setIsDragging(true);

  const handleMouseUp = () => setIsDragging(false);
  const handleTouchEnd = () => setIsDragging(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) handleMove(e.clientX);
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) handleMove(e.touches[0].clientX);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMove]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden rounded-[2.5rem] cursor-col-resize group"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* After Image (Background) */}
      <img 
        src={afterImage} 
        alt="Restored" 
        className="absolute top-0 left-0 w-full h-full object-contain bg-stone-100" 
      />
      
      {/* Before Image (Clipped on top) */}
      <div 
        className="absolute top-0 left-0 h-full w-full bg-stone-100 overflow-hidden"
        style={{ width: `${sliderPosition}%` }}
      >
        <img 
          src={beforeImage} 
          alt="Original" 
          className="absolute top-0 left-0 max-w-none h-full w-full object-contain object-left"
          style={{ width: containerRef.current?.offsetWidth || '100%' }} 
        />
      </div>

      {/* Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white cursor-col-resize z-20 shadow-[0_0_10px_rgba(0,0,0,0.5)] flex items-center justify-center"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="w-8 h-8 -ml-3.5 bg-white rounded-full shadow-lg flex items-center justify-center text-stone-900 transform transition-transform group-hover:scale-110">
          <ChevronsLeftRight size={16} />
        </div>
      </div>

      {/* Labels */}
      <div className="absolute bottom-6 left-6 z-10 px-3 py-1 bg-stone-900/80 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-widest pointer-events-none">
        {labelBefore}
      </div>
      <div className="absolute bottom-6 right-6 z-10 px-3 py-1 bg-white/80 backdrop-blur-md rounded-full text-[10px] font-bold text-stone-900 uppercase tracking-widest pointer-events-none">
        {labelAfter}
      </div>
    </div>
  );
};