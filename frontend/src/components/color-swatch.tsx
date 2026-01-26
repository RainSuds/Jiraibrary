"use client";

import type { CSSProperties } from "react";

export type ColorSwatchInput = {
  hex?: string | null;
};

type ColorSwatchProps = {
  colors: ColorSwatchInput[];
  className?: string;
  dotClassName?: string;
};

export default function ColorSwatch({ colors, className = "", dotClassName = "" }: ColorSwatchProps) {
  const normalized = colors
    .map((color) => color?.hex ?? "#d4d4d8")
    .filter((value): value is string => Boolean(value));

  if (normalized.length === 0) {
    return null;
  }

  const baseDot = `h-3 w-3 rounded-full border border-rose-200/70 ${dotClassName}`.trim();

  if (normalized.length === 1) {
    return (
      <span
        className={`${baseDot} ${className}`.trim()}
        style={{
          backgroundColor: normalized[0],
          boxShadow: "inset 0 0 0 1px #ffffff",
        } as CSSProperties}
      />
    );
  }

  if (normalized.length === 2) {
    const [left, right] = normalized;
    return (
      <span
        className={`${baseDot} relative overflow-hidden ${className}`.trim()}
        style={{ boxShadow: "inset 0 0 0 1px #ffffff" } as CSSProperties}
      >
        <span
          className="absolute inset-px rounded-full"
          style={{
            backgroundImage: `linear-gradient(135deg, ${left} 0 50%, ${right} 50% 100%)`,
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1 ${className}`.trim()}>
      {normalized.map((hex, index) => (
        <span
          key={`${hex}-${index}`}
          className={baseDot}
          style={{
            backgroundColor: hex,
            boxShadow: "inset 0 0 0 1px #ffffff",
          } as CSSProperties}
        />
      ))}
    </span>
  );
}
