'use client';

import Image from "next/image";
import { useMemo, useState } from "react";

import type { ImageDetail } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";

type ItemGalleryProps = {
  images: ImageDetail[];
  alt: string;
  placeholderUrl: string;
};

export default function ItemGallery({ images, alt, placeholderUrl }: ItemGalleryProps) {
  const slides = useMemo(() => {
    if (!images || images.length === 0) {
      return [
        {
          id: null,
          url: placeholderUrl,
          is_cover: true,
          type: "cover",
          width: null,
          height: null,
        },
      ];
    }
    return images.map((image) => {
      const resolved = resolveMediaUrl(image.url) ?? placeholderUrl;
      return {
        ...image,
        url: resolved,
      };
    });
  }, [images, placeholderUrl]);

  const [index, setIndex] = useState(0);
  const current = slides[index] ?? slides[0];

  const goPrevious = () => {
    setIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const goNext = () => {
    setIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative overflow-hidden rounded-3xl border border-rose-100 bg-rose-50"
        style={{ aspectRatio: "3 / 4" }}
      >
        <Image
          src={current.url}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="h-full w-full object-cover"
          loading="lazy"
          unoptimized
        />
        {slides.length > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrevious}
              className="absolute left-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full bg-white/80 p-2 text-sm text-rose-700 shadow transition hover:bg-white"
              aria-label="Previous image"
            >
              {"<"}
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full bg-white/80 p-2 text-sm text-rose-700 shadow transition hover:bg-white"
              aria-label="Next image"
            >
              {">"}
            </button>
          </>
        ) : null}
      </div>
      {slides.length > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {slides.map((slide, slideIndex) => (
            <button
              key={slide.id ?? `${slide.url}-${slideIndex}`}
              type="button"
              onClick={() => setIndex(slideIndex)}
              className={`h-2 w-8 rounded-full transition ${
                slideIndex === index ? "bg-rose-600" : "bg-rose-200"
              }`}
              aria-label={`Go to image ${slideIndex + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
