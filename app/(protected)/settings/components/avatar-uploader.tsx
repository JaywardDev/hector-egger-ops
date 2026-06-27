"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/src/components/ui/alert";
import { Avatar } from "@/src/components/ui/avatar";
import { Button } from "@/src/components/ui/button";

const VIEW = 256; // crop viewport + output size in px
const MAX_INPUT_BYTES = 15_000_000;

type Pan = { x: number; y: number };

const geometry = (iw: number, ih: number, scale: number, pan: Pan) => {
  const coverScale = VIEW / Math.min(iw, ih);
  const drawW = iw * coverScale * scale;
  const drawH = ih * coverScale * scale;
  const left = (VIEW - drawW) / 2 + pan.x;
  const top = (VIEW - drawH) / 2 + pan.y;
  return { drawW, drawH, left, top };
};

const clampPan = (iw: number, ih: number, scale: number, pan: Pan): Pan => {
  const coverScale = VIEW / Math.min(iw, ih);
  const drawW = iw * coverScale * scale;
  const drawH = ih * coverScale * scale;
  const maxX = Math.max(0, (drawW - VIEW) / 2);
  const maxY = Math.max(0, (drawH - VIEW) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, pan.x)),
    y: Math.min(maxY, Math.max(-maxY, pan.y)),
  };
};

export function AvatarUploader({
  profileId,
  name,
  initialHasAvatar,
}: {
  profileId: string;
  name: string;
  initialHasAvatar: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPan: Pan } | null>(null);

  const [hasAvatar, setHasAvatar] = useState(initialHasAvatar);
  const [cacheBust, setCacheBust] = useState(() => Date.now());
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const resetCrop = useCallback(() => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setNatural(null);
    setScale(1);
    setPan({ x: 0, y: 0 });
    imageRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [cropSrc]);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    if (!file.type.startsWith("image/")) {
      setFeedback({ type: "error", message: "Choose an image file." });
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setFeedback({ type: "error", message: "That image is too large. Choose one under 15 MB." });
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setScale(1);
      setPan({ x: 0, y: 0 });
      setCropSrc(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setFeedback({ type: "error", message: "That image could not be loaded." });
    };
    img.src = url;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, startPan: pan };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !natural) return;
    const next = {
      x: dragRef.current.startPan.x + (event.clientX - dragRef.current.startX),
      y: dragRef.current.startPan.y + (event.clientY - dragRef.current.startY),
    };
    setPan(clampPan(natural.w, natural.h, scale, next));
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const onZoom = (value: number) => {
    if (!natural) return;
    setScale(value);
    setPan((current) => clampPan(natural.w, natural.h, value, current));
  };

  const saveCrop = useCallback(async () => {
    const img = imageRef.current;
    if (!img || !natural) return;
    setBusy(true);
    setFeedback(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = VIEW;
      canvas.height = VIEW;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable.");
      ctx.save();
      ctx.beginPath();
      ctx.arc(VIEW / 2, VIEW / 2, VIEW / 2, 0, Math.PI * 2);
      ctx.clip();
      const { drawW, drawH, left, top } = geometry(natural.w, natural.h, scale, pan);
      ctx.drawImage(img, left, top, drawW, drawH);
      ctx.restore();

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not process the image.");

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: blob,
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "Upload failed.");

      setHasAvatar(true);
      setCacheBust(Date.now());
      setFeedback({ type: "success", message: "Profile photo updated." });
      resetCrop();
      router.refresh();
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Upload failed." });
    } finally {
      setBusy(false);
    }
  }, [natural, pan, resetCrop, router, scale]);

  const removeAvatar = useCallback(async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not remove your photo.");
      setHasAvatar(false);
      setCacheBust(Date.now());
      setFeedback({ type: "success", message: "Profile photo removed." });
      router.refresh();
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Could not remove your photo." });
    } finally {
      setBusy(false);
    }
  }, [router]);

  const display = natural ? geometry(natural.w, natural.h, scale, pan) : null;

  return (
    <div className="space-y-3">
      {feedback ? <Alert variant={feedback.type}>{feedback.message}</Alert> : null}

      {cropSrc && natural && display ? (
        <div className="space-y-3">
          <div
            className="relative mx-auto touch-none overflow-hidden rounded-full border-2 border-[var(--he-yellow)] bg-zinc-100"
            style={{ width: VIEW, height: VIEW, maxWidth: "100%" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cropSrc}
              alt="Crop preview"
              draggable={false}
              className="pointer-events-none absolute select-none"
              style={{ left: display.left, top: display.top, width: display.drawW, height: display.drawH, maxWidth: "none" }}
            />
          </div>
          <label className="block text-sm text-zinc-600">
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={scale}
              onChange={(event) => onZoom(Number(event.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <p className="text-center text-xs text-zinc-500">Drag the image to reposition it inside the circle.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="brand" onClick={saveCrop} disabled={busy}>
              {busy ? "Saving…" : "Save photo"}
            </Button>
            <Button type="button" variant="secondary" onClick={resetCrop} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <Avatar profileId={profileId} name={name} hasAvatar={hasAvatar} size={72} cacheBust={cacheBust} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              {hasAvatar ? "Change photo" : "Upload photo"}
            </Button>
            {hasAvatar ? (
              <Button type="button" variant="secondary" onClick={removeAvatar} disabled={busy}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  );
}
