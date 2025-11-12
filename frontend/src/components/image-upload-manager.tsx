"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, DragEvent, useCallback, useMemo, useRef, useState } from "react";

import { UploadedImageSummary, deleteItemImage, updateItemImage, uploadItemImage } from "@/lib/api";

type ImageUploadManagerProps = {
  token: string | null;
  onImagesChange?: (images: UploadedImageSummary[]) => void;
  initialImages?: UploadedImageSummary[];
  title?: string;
  description?: string;
};

type DragState = {
  sourceIndex: number | null;
};

function ensureCover(images: UploadedImageSummary[]): UploadedImageSummary[] {
  return images.map((image, index) => ({
    ...image,
    is_cover: index === 0,
  }));
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export default function ImageUploadManager({
  token,
  onImagesChange,
  initialImages,
  title = "Upload images",
  description = "Drag and drop files or browse to upload. Drag thumbnails to reorder; the first image becomes the cover.",
}: ImageUploadManagerProps) {
  const coverIdRef = useRef<string | null>(null);
  const [images, setImages] = useState<UploadedImageSummary[]>(() => {
    const next = ensureCover(initialImages ?? []);
    coverIdRef.current = next[0]?.id ?? null;
    return next;
  });
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const dragState = useRef<DragState>({ sourceIndex: null });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const disabled = !token;

  const notifyChange = useCallback(
    (nextImages: UploadedImageSummary[]) => {
      onImagesChange?.(nextImages);
    },
    [onImagesChange]
  );

  const persistCover = useCallback(
    async (nextImages: UploadedImageSummary[]) => {
      const newCoverId = nextImages[0]?.id ?? null;
      if (!token) {
        coverIdRef.current = newCoverId;
        return;
      }
      if (nextImages.length === 0) {
        coverIdRef.current = null;
        return;
      }
      const previousCoverId = coverIdRef.current;
  const updates = new Map<string, { is_cover: boolean }>();
  const remainingIds = new Set(nextImages.map((image) => image.id));
      if (newCoverId && newCoverId !== previousCoverId) {
        updates.set(newCoverId, { is_cover: true });
      }
      for (const image of nextImages.slice(1)) {
        if (image.is_cover) {
          updates.set(image.id, { is_cover: false });
        }
      }
      if (previousCoverId && previousCoverId !== newCoverId && remainingIds.has(previousCoverId)) {
        updates.set(previousCoverId, { is_cover: false });
      }
      if (updates.size === 0) {
        coverIdRef.current = newCoverId;
        return;
      }
      try {
        await Promise.all(
          Array.from(updates.entries()).map(([imageId, payload]) => updateItemImage(token, imageId, payload))
        );
        coverIdRef.current = newCoverId;
      } catch (apiError) {
        console.error(apiError);
        setError("Unable to update cover image. Please try again.");
      }
    },
    [token]
  );

  const applyImages = useCallback(
    (candidate: UploadedImageSummary[]) => {
      const normalized = ensureCover(candidate);
      setImages(normalized);
      notifyChange(normalized);
      void persistCover(normalized);
    },
    [notifyChange, persistCover]
  );

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (!token) {
        setError("Login is required before uploading images.");
        return;
      }
      const files = Array.from(fileList).filter(isImageFile);
      if (files.length === 0) {
        setError("Please choose image files.");
        return;
      }
      setError(null);
      setIsUploading(true);
      try {
        const uploaded: UploadedImageSummary[] = [];
        for (const [index, file] of files.entries()) {
          const result = await uploadItemImage(token, file, {
            isCover: images.length === 0 && index === 0,
          });
          uploaded.push(result);
        }
        if (uploaded.length > 0) {
          applyImages([...images, ...uploaded]);
        }
      } catch (uploadError) {
        console.error(uploadError);
        setError(uploadError instanceof Error ? uploadError.message : "Upload failed. Try again.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [applyImages, images, token]
  );

  const handleFileInput = useCallback(
  (event: ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files) {
        return;
      }
      void handleFiles(event.target.files);
    },
    [handleFiles]
  );

  const handleDrop = useCallback(
  (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const transfer = event.dataTransfer;
      if (transfer.files && transfer.files.length > 0) {
        void handleFiles(transfer.files);
        transfer.clearData();
      }
    },
    [handleFiles]
  );

  const handleDragStart = useCallback((index: number) => (event: DragEvent<HTMLLIElement>) => {
    dragState.current.sourceIndex = index;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      event.dataTransfer.dropEffect = "copy";
      return;
    }
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleReorder = useCallback(
    (targetIndex: number) => (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        void handleFiles(event.dataTransfer.files);
        return;
      }
      const data = event.dataTransfer.getData("text/plain");
      const sourceIndex = dragState.current.sourceIndex ?? (data ? Number.parseInt(data, 10) : NaN);
      dragState.current.sourceIndex = null;
      if (Number.isNaN(sourceIndex) || sourceIndex === targetIndex) {
        return;
      }
      setError(null);
      setImages((previous) => {
        const next = [...previous];
        const [moved] = next.splice(sourceIndex, 1);
        if (!moved) {
          return previous;
        }
        next.splice(targetIndex, 0, moved);
        const normalized = ensureCover(next);
        notifyChange(normalized);
        void persistCover(normalized);
        return normalized;
      });
    },
    [handleFiles, notifyChange, persistCover]
  );

  const handleRemove = useCallback(
    async (imageId: string) => {
      if (!token) {
        setError("Login is required before deleting images.");
        return;
      }
      setDeletingId(imageId);
      setError(null);
      try {
        await deleteItemImage(token, imageId);
        applyImages(images.filter((image) => image.id !== imageId));
      } catch (removeError) {
        console.error(removeError);
        setError(removeError instanceof Error ? removeError.message : "Unable to remove image.");
      } finally {
        setDeletingId(null);
      }
    },
    [applyImages, images, token]
  );

  const coverLabel = useMemo(() => (images.length > 0 ? images[0] : null), [images]);

  return (
    <section className="rounded-3xl border border-rose-100 bg-white/95 p-6 shadow-lg">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-rose-900">{title}</h2>
        <p className="text-sm text-rose-500">{description}</p>
        {disabled ? (
          <p className="text-sm text-rose-400">Log in to upload images.</p>
        ) : null}
      </header>
      <div
        className={`mt-5 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-rose-200 bg-rose-50/40 p-6 text-sm text-rose-500 transition ${
          disabled ? "opacity-60" : "hover:border-rose-400 hover:bg-rose-50"
        }`}
        onDragOver={(event) => {
          if (!disabled) {
            event.preventDefault();
          }
        }}
        onDrop={disabled ? undefined : handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={disabled ? undefined : handleFileInput}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full border border-rose-200 px-4 py-2 font-semibold text-rose-700 hover:border-rose-400 hover:text-rose-800"
          disabled={disabled || isUploading}
        >
          {isUploading ? "Uploading…" : "Browse files"}
        </button>
        <p className="text-xs text-rose-400">or drag images here</p>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {images.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="group relative cursor-grab rounded-2xl border border-rose-100 bg-white shadow-sm transition hover:border-rose-300 active:cursor-grabbing"
              draggable={!disabled}
              onDragStart={disabled ? undefined : handleDragStart(index)}
              onDragOver={disabled ? undefined : handleDragOver}
              onDrop={disabled ? undefined : handleReorder(index)}
            >
              <figure className="overflow-hidden rounded-2xl">
                <img
                  src={image.url}
                  alt={image.caption ?? `Uploaded image ${index + 1}`}
                  className="h-48 w-full object-cover"
                />
              </figure>
              <div className="flex items-center justify-between px-4 py-3 text-xs text-rose-500">
                <span className="font-medium uppercase tracking-wide">
                  {index === 0 ? "Cover" : "Gallery"}
                </span>
                <button
                  type="button"
                  className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold text-rose-500 transition hover:border-rose-200 hover:text-rose-700"
                  onClick={() => handleRemove(image.id)}
                  disabled={deletingId === image.id || disabled}
                >
                  {deletingId === image.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-rose-400">No images uploaded yet.</p>
      )}
      {coverLabel ? (
        <p className="mt-4 text-xs text-rose-400">
          Cover image URL: <span className="break-all font-medium text-rose-600">{coverLabel.url}</span>
        </p>
      ) : null}
    </section>
  );
}
