"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CameraIcon,
  CloseIcon,
  SwitchCameraIcon,
  UploadIcon,
} from "@/components/app-pages/shared/icons";

type FacingMode = "environment" | "user";

type PhotoCaptureDialogProps = {
  onCapture: (file: File) => void;
  onClose: () => void;
  onChooseFile?: () => void;
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function createCapturedPhotoFile(blob: Blob) {
  return new File([blob], `cat-photo-${Date.now()}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export function PhotoCaptureDialog({
  onCapture,
  onClose,
  onChooseFile,
}: PhotoCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [starting, setStarting] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let activeStream: MediaStream | null = null;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera capture is not available in this browser.");
          return;
        }

        const nextStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1600 },
            height: { ideal: 1600 },
          },
          audio: false,
        });

        if (cancelled) {
          stopStream(nextStream);
          return;
        }

        activeStream = nextStream;
        setStream(nextStream);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Camera permission was blocked or unavailable.",
        );
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopStream(activeStream);
    };
  }, [facingMode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  const handleClose = useCallback(() => {
    stopStream(stream);
    onClose();
  }, [onClose, stream]);

  const handleSwitchCamera = useCallback(() => {
    setVideoReady(false);
    setStarting(true);
    stopStream(stream);
    setStream(null);
    setFacingMode((current) =>
      current === "environment" ? "user" : "environment",
    );
  }, [stream]);

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) {
      setError("Could not capture the photo. Please try again.");
      return;
    }

    onCapture(createCapturedPhotoFile(blob));
    handleClose();
  }, [facingMode, handleClose, onCapture]);

  const canCapture = Boolean(stream && videoReady && !starting && !error);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-[2px]"
      onClick={(event) => {
        event.stopPropagation();
        handleClose();
      }}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-brand-dark shadow-2xl ring-1 ring-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative aspect-[3/4] bg-black">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <CameraIcon className="h-10 w-10 text-white/45" />
              <p className="text-sm font-semibold leading-relaxed text-white/80">
                {error}
              </p>
              {onChooseFile ? (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onChooseFile();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-dark transition-opacity hover:opacity-90"
                >
                  <UploadIcon className="h-4 w-4" />
                  Choose file
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                aria-label="Camera preview"
                onLoadedMetadata={() => setVideoReady(true)}
                className={`h-full w-full object-cover ${
                  facingMode === "user" ? "scale-x-[-1]" : ""
                }`}
              />
              {starting ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                </div>
              ) : null}
            </>
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-linear-to-b from-black/70 to-transparent p-3">
            <button
              type="button"
              onClick={handleClose}
              className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-opacity hover:opacity-80"
              aria-label="Close camera"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
            {!error ? (
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-opacity hover:opacity-80"
                aria-label="Switch camera"
              >
                <SwitchCameraIcon className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 bg-brand-dark px-5 py-4">
          {onChooseFile ? (
            <button
              type="button"
              onClick={() => {
                handleClose();
                onChooseFile();
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-opacity hover:opacity-80"
              aria-label="Choose file"
            >
              <UploadIcon className="h-5 w-5" />
            </button>
          ) : (
            <span className="h-11 w-11" aria-hidden="true" />
          )}

          <button
            type="button"
            disabled={!canCapture}
            onClick={handleCapture}
            className="inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 bg-white text-brand-dark shadow-lg transition-transform hover:scale-105 disabled:scale-100 disabled:opacity-45"
            aria-label="Take photo"
          >
            <CameraIcon className="h-7 w-7" />
          </button>

          <span className="h-11 w-11" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
