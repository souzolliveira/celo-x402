"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

export function QrCapture({
  onCode,
  startLabel = "Open camera",
  showIdle = true,
}: {
  onCode: (code: string) => void;
  startLabel?: string;
  showIdle?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    return () => stopTracks();
  }, []);

  function stopTracks() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function stopCamera() {
    stopTracks();
    setCameraOn(false);
  }

  async function startCamera() {
    setCameraError(null);
    const Detector = window.BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("This camera cannot read a QR here. Paste the code in the field below.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      setCameraOn(true);
      const detector = new Detector({ formats: ["qr_code"] });
      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          frameRef.current = requestAnimationFrame(() => void scan());
          return;
        }
        const codes = await detector.detect(videoRef.current).catch(() => []);
        const value = codes[0]?.rawValue;
        if (value) {
          stopCamera();
          onCode(value);
          return;
        }
        frameRef.current = requestAnimationFrame(() => void scan());
      };
      frameRef.current = requestAnimationFrame(() => void scan());
    } catch {
      stopTracks();
      setCameraOn(false);
      setCameraError("Could not open the camera. Paste the code in the field below.");
    }
  }

  const frameOpen = cameraOn || showIdle;

  return (
    <div>
      <div className={frameOpen ? "overflow-hidden rounded-2xl border border-border bg-muted" : undefined}>
        <video
          ref={videoRef}
          muted
          playsInline
          className={`bg-muted object-cover ${cameraOn ? "aspect-square w-full max-w-sm" : "hidden"}`}
        />
        {showIdle && !cameraOn ? (
          <p className="flex aspect-square w-full max-w-sm items-center px-6 text-sm text-muted-foreground">
            Point the camera at the QR, or paste the code below.
          </p>
        ) : null}
      </div>
      <div className={`flex flex-wrap gap-3 ${frameOpen ? "mt-4" : ""}`}>
        {cameraOn ? (
          <Button type="button" variant="quiet" onClick={stopCamera}>
            Close camera
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={() => void startCamera()}>
            {startLabel}
          </Button>
        )}
      </div>
      {cameraError ? <p className="mt-3 text-sm font-medium text-destructive">{cameraError}</p> : null}
    </div>
  );
}

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => {
      detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
    };
  }
}
