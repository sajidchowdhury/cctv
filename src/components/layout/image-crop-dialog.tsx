"use client";

/**
 * ImageCropDialog — file picker → crop preview → upload.
 *
 * Why this exists:
 *   The invoice header + footer images render at fixed heights on the invoice
 *   (header: 96px tall, footer: 64px tall, both full-width inside an 800px box).
 *   Without a cropper, users had no idea what aspect ratio to upload, so the
 *   result was always squished or cropped arbitrarily by object-fit: cover.
 *
 * Flow:
 *   1. Parent renders <ImageCropDialog open aspect={width/height} onConfirm={...}>
 *   2. User clicks "Choose file" → file input opens.
 *   3. On file selected, the image is drawn into a <canvas> at the target aspect
 *      ratio. User drags to reposition (we just track an offset).
 *   4. User clicks "Crop & Upload" → canvas.toBlob() → onConfirm(blob, previewUrl).
 *
 * Implementation notes:
 *   - No external deps (react-easy-crop, react-image-crop, etc.). Pure canvas +
 *     pointer events. Keeps bundle small + avoids version conflicts.
 *   - Cropping uses object-fit: cover math: we center the image, then translate
 *     it by the drag delta clamped to (imageSize - canvasSize) so edges never
 *     show. Zoom is fixed at 1 (cover-fit) — adding zoom would complicate UX
 *     without much benefit for a small fixed-height banner.
 *   - Output is PNG (lossless) for crisp text rendering on invoices. If the
 *     source is a photo, PNG is fine — file size is small at these dimensions.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Check, X } from "lucide-react";

export type CropResult = {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
};

export function ImageCropDialog({
  open,
  onOpenChange,
  title,
  description,
  aspect,
  outputWidth,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Width / height of the crop region (e.g. 800/96 = 8.33 for header). */
  aspect: number;
  /** Output canvas width in pixels. Height is derived from aspect. */
  outputWidth: number;
  onConfirm: (result: CropResult) => Promise<void> | void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Raw source image (Object URL) — set when user picks a file.
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  // Drag offset in canvas pixels. 0,0 = image centered.
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Max drag range — computed when image loads (depends on image dimensions).
  const [range, setRange] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Drag state — non-null while pointer is down.
  const dragRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  // Reset state when dialog closes.
  useEffect(() => {
    if (!open) {
      // Small delay so the close animation isn't janky.
      const t = setTimeout(() => {
        if (sourceUrl) URL.revokeObjectURL(sourceUrl);
        setSourceUrl(null);
        setOffset({ x: 0, y: 0 });
        setRange({ x: 0, y: 0 });
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open, sourceUrl]);

  // Redraw canvas whenever source, offset, or aspect changes.
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;

    const outputHeight = Math.round(outputWidth / aspect);
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, outputWidth, outputHeight);

    // Cover-fit: scale image so it covers the canvas, then translate by offset.
    const scale = Math.max(
      outputWidth / img.naturalWidth,
      outputHeight / img.naturalHeight
    );
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    // Max drag range: how far we can move the image in each direction
    // before edges show. Half on each side.
    const maxX = Math.max(0, (drawW - outputWidth) / 2);
    const maxY = Math.max(0, (drawH - outputHeight) / 2);
    setRange({ x: maxX, y: maxY });

    // Clamp offset to allowed range.
    const clampedX = Math.max(-maxX, Math.min(maxX, offset.x));
    const clampedY = Math.max(-maxY, Math.min(maxY, offset.y));

    // Draw image centered + translated.
    const dx = (outputWidth - drawW) / 2 + clampedX;
    const dy = (outputHeight - drawH) / 2 + clampedY;
    ctx.drawImage(img, dx, dy, drawW, drawH);
  }, [offset, aspect, outputWidth]);

  // Re-draw on any state change.
  useEffect(() => {
    draw();
  }, [draw, sourceUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      alert("Image is too large (max 10 MB).");
      return;
    }
    const url = URL.createObjectURL(f);
    setSourceUrl(url);
    setOffset({ x: 0, y: 0 });
  }

  function handleImageLoad() {
    // Initial draw happens via the draw() effect when imgRef becomes complete.
    draw();
  }

  // Pointer drag handlers (work for both mouse + touch).
  function onPointerDown(e: React.PointerEvent) {
    if (!sourceUrl) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset({
      x: dragRef.current.startOffsetX + dx,
      y: dragRef.current.startOffsetY + dy,
    });
  }
  function onPointerUp(e: React.PointerEvent) {
    if (dragRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
    dragRef.current = null;
  }

  async function handleConfirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setUploading(true);
    try {
      // toBlob with PNG for crisp text rendering.
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
      });
      if (!blob) {
        alert("Could not generate cropped image. Try a different file.");
        setUploading(false);
        return;
      }
      const previewUrl = canvas.toDataURL("image/png");
      await onConfirm({
        blob,
        previewUrl,
        width: canvas.width,
        height: canvas.height,
      });
      onOpenChange(false);
    } finally {
      setUploading(false);
    }
  }

  // Output height for CSS aspect-ratio on the canvas wrapper.
  const outputHeight = Math.round(outputWidth / aspect);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Hidden image element — source for canvas drawing. */}
        {sourceUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={sourceUrl}
            alt="Source"
            onLoad={handleImageLoad}
            className="hidden"
          />
        )}

        {/* Crop area — canvas with aspect-ratio matching the output. */}
        <div className="space-y-3">
          <div
            className="relative w-full rounded-lg border-2 border-dashed overflow-hidden bg-muted/30 select-none"
            style={{
              aspectRatio: `${outputWidth} / ${outputHeight}`,
              maxHeight: "320px",
              margin: "0 auto",
            }}
          >
            {sourceUrl ? (
              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="w-full h-full block touch-none cursor-move"
                style={{ aspectRatio: `${outputWidth} / ${outputHeight}` }}
              />
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Upload className="h-8 w-8 mb-2" />
                <span className="text-sm font-medium">Click to choose an image</span>
                <span className="text-xs mt-1">
                  Recommended: {outputWidth}×{outputHeight}px (aspect {aspect.toFixed(2)}:1)
                </span>
              </button>
            )}
          </div>

          {sourceUrl && (
            <p className="text-xs text-muted-foreground text-center">
              Drag to reposition. The preview above shows exactly how the image
              will appear on the invoice — same width:{outputHeight}px height ratio.
            </p>
          )}

          {/* Hidden file input — triggered by the empty-state button. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            <X className="mr-2 h-4 w-4" /> Cancel
          </Button>
          {!sourceUrl ? (
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Choose image
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
                  setSourceUrl(null);
                  setOffset({ x: 0, y: 0 });
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                disabled={uploading}
              >
                Pick different
              </Button>
              <Button onClick={handleConfirm} disabled={uploading}>
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Crop &amp; Upload
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
