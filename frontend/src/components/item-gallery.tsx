"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [isModalOpen, setModalOpen] = useState(false);
  const current = slides[index] ?? slides[0];

  const goPrevious = useCallback(() => {
    setIndex((prev) => {
      if (slides.length <= 1) {
        return prev;
      }
      return prev === 0 ? slides.length - 1 : prev - 1;
    });
  }, [slides.length]);

  const goNext = useCallback(() => {
    setIndex((prev) => {
      if (slides.length <= 1) {
        return prev;
      }
      return prev === slides.length - 1 ? 0 : prev + 1;
    });
  }, [slides.length]);

  const openModal = () => {
    if (slides.length === 0) {
      return;
    }
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrevious, isModalOpen]);

  const hasMultiple = slides.length > 1;

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,1.25fr)] lg:items-start">
      <div className="group relative overflow-hidden rounded-3xl border border-rose-100 bg-rose-50" style={{ aspectRatio: "3 / 4" }}>
        <Image
          src={current.url}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 35vw, 90vw"
          className="h-full w-full object-cover"
          loading="lazy"
          unoptimized
        />
        <button
          type="button"
          className="absolute inset-0 z-10 cursor-zoom-in"
          aria-label="Open full image viewer"
          onClick={openModal}
        />
        {hasMultiple ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                goPrevious();
              }}
              className="absolute left-4 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-lg text-rose-700 opacity-0 shadow transition hover:bg-white group-hover:opacity-100"
              aria-label="Previous image"
            >
              <span aria-hidden="true">&lt;</span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                goNext();
              }}
              className="absolute right-4 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-lg text-rose-700 opacity-0 shadow transition hover:bg-white group-hover:opacity-100"
              aria-label="Next image"
            >
              <span aria-hidden="true">&gt;</span>
            </button>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-2">
        {slides.map((slide, slideIndex) => (
          <button
            key={slide.id ?? `${slide.url}-${slideIndex}`}
            type="button"
            onClick={() => setIndex(slideIndex)}
            className={`relative overflow-hidden rounded-2xl border ${
              slideIndex === index ? "border-rose-400 ring-2 ring-rose-200" : "border-rose-100"
            } bg-white/70 transition hover:border-rose-300`}
            style={{ aspectRatio: "3 / 4" }}
            aria-label={`Show image ${slideIndex + 1}`}
          >
            <Image
              src={slide.url}
              alt={`${alt} thumbnail ${slideIndex + 1}`}
              fill
              className="object-cover"
              sizes="120px"
              loading="lazy"
              unoptimized
            />
          </button>
        ))}
        {slides.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-rose-200 bg-rose-50/60 p-4 text-center text-xs text-rose-400">
            More looks coming soon
          </div>
        ) : null}
      </div>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
        >
          <div className="relative w-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="absolute right-0 top-0 z-20 rounded-full bg-white/80 p-2 text-sm text-rose-700 shadow hover:bg-white"
              aria-label="Close image viewer"
              onClick={closeModal}
            >
              ✕
            </button>
            <div className="relative overflow-hidden rounded-3xl bg-black" style={{ aspectRatio: "3 / 4" }}>
              <Image
                src={current.url}
                alt={alt}
                fill
                className="object-contain"
                sizes="(min-width: 1024px) 50vw, 90vw"
                loading="lazy"
                unoptimized
              />
              {hasMultiple ? (
                <>
                  <button
                    type="button"
                    onClick={goPrevious}
                    className="absolute left-4 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-xl text-rose-700 shadow transition hover:bg-white"
                    aria-label="Previous image"
                  >
                    <span aria-hidden="true">&lt;</span>
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="absolute right-4 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-xl text-rose-700 shadow transition hover:bg-white"
                    aria-label="Next image"
                  >
                    <span aria-hidden="true">&gt;</span>
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
