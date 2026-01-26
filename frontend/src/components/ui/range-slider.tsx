"use client";

import { useRef } from "react";

type RangeSliderProps = {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  step?: number;
  onChangeMin: (value: number) => void;
  onChangeMax: (value: number) => void;
  onCommit?: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const applyStep = (value: number, min: number, step?: number) => {
  if (!step || step <= 0) {
    return value;
  }
  return min + Math.round((value - min) / step) * step;
};

export default function RangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  step,
  onChangeMin,
  onChangeMax,
  onCommit,
}: RangeSliderProps) {
  const activeHandleRef = useRef<"min" | "max" | null>(null);

  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  const minValue = clamp(valueMin, safeMin, safeMax);
  const maxValue = clamp(valueMax, safeMin, safeMax);

  const percentForValue = (value: number) => {
    if (safeMax === safeMin) {
      return 0;
    }
    const raw = ((value - safeMin) / (safeMax - safeMin)) * 100;
    if (!Number.isFinite(raw)) {
      return 0;
    }
    return Math.max(0, Math.min(100, raw));
  };

  const startPercent = percentForValue(Math.min(minValue, maxValue));
  const endPercent = percentForValue(Math.max(minValue, maxValue));
  const trackStyle = {
    background: `linear-gradient(to right, #ffe4e6 0%, #ffe4e6 ${startPercent}%, #fda4af ${startPercent}%, #fda4af ${endPercent}%, #ffe4e6 ${endPercent}%, #ffe4e6 100%)`,
  } as const;

  const valueFromEvent = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    const clampedRatio = Math.min(Math.max(ratio, 0), 1);
    const rawValue = safeMin + clampedRatio * (safeMax - safeMin);
    const stepped = applyStep(rawValue, safeMin, step);
    return clamp(stepped, safeMin, safeMax);
  };

  const applyValue = (handle: "min" | "max", nextValue: number) => {
    if (handle === "min") {
      onChangeMin(nextValue);
    } else {
      onChangeMax(nextValue);
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const clickedValue = valueFromEvent(event);
    const distToMin = Math.abs(clickedValue - minValue);
    const distToMax = Math.abs(clickedValue - maxValue);
    const nextHandle: "min" | "max" = distToMin <= distToMax ? "min" : "max";
    activeHandleRef.current = nextHandle;
    applyValue(nextHandle, clickedValue);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activeHandleRef.current) {
      return;
    }
    const nextValue = valueFromEvent(event);
    applyValue(activeHandleRef.current, nextValue);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activeHandleRef.current) {
      return;
    }
    const nextValue = valueFromEvent(event);
    applyValue(activeHandleRef.current, nextValue);
    activeHandleRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onCommit?.();
  };

  const handleMinInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = applyStep(Number(event.target.value), safeMin, step);
    if (Number.isNaN(nextValue)) {
      return;
    }
    onChangeMin(clamp(nextValue, safeMin, safeMax));
  };

  const handleMaxInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = applyStep(Number(event.target.value), safeMin, step);
    if (Number.isNaN(nextValue)) {
      return;
    }
    onChangeMax(clamp(nextValue, safeMin, safeMax));
  };

  return (
    <div
      className="relative h-1 w-full"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="absolute inset-0 h-1 w-full rounded-full" style={trackStyle} />
      <input
        type="range"
        min={safeMin}
        max={safeMax}
        step={step}
        value={minValue}
        onChange={handleMinInputChange}
        className="range-dual pointer-events-none absolute inset-0 z-10 h-1 w-full appearance-none rounded-full bg-transparent accent-rose-500"
      />
      <input
        type="range"
        min={safeMin}
        max={safeMax}
        step={step}
        value={maxValue}
        onChange={handleMaxInputChange}
        className="range-dual pointer-events-none absolute inset-0 z-10 h-1 w-full appearance-none rounded-full bg-transparent accent-rose-500"
      />
    </div>
  );
}
