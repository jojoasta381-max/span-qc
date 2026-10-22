"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

const TOTAL_FRAMES = 120;
const INITIAL_THRESHOLD = 20;

export function ScrollHeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const posterRef = useRef<HTMLImageElement | null>(null);
  const [loadCount, setLoadCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // References to preserve mutable state across animation frames
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const targetProgressRef = useRef(0);
  const smoothedProgressRef = useRef(0);
  const lastDrawnIndexRef = useRef(-1);
  const rafIdRef = useRef<number | null>(null);
  const frameDirRef = useRef("/frames");

  const getFramePath = useCallback((dir: string, index: number) => {
    const pad = String(index + 1).padStart(3, "0");
    return `${dir}/frame_${pad}.webp`;
  }, []);

  const getLoadedFrame = useCallback((index: number) => {
    const images = imagesRef.current;
    if (images[index]?.complete && images[index].naturalWidth > 0) {
      return images[index];
    }
    // Search nearest loaded frame
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = index - offset;
      if (prev >= 0 && images[prev]?.complete && images[prev].naturalWidth > 0) {
        return images[prev];
      }
      const next = index + offset;
      if (next < TOTAL_FRAMES && images[next]?.complete && images[next].naturalWidth > 0) {
        return images[next];
      }
    }
    return images[0] || null;
  }, []);

  const drawFrame = useCallback(
    (index: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = getLoadedFrame(index);
      if (!img || !img.complete || img.naturalWidth === 0) return;

      // High quality smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const cw = canvas.width;
      const ch = canvas.height;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;

      // Object-cover math with whole-pixel rounding
      const scale = Math.max(cw / iw, ch / ih);
      const w = Math.round(iw * scale);
      const h = Math.round(ih * scale);
      const x = Math.round((cw - w) / 2);
      const y = Math.round((ch - h) / 2);

      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, x, y, w, h);
      lastDrawnIndexRef.current = index;
      if (typeof window !== "undefined") {
        (window as unknown as { lastDrawnIndex?: number }).lastDrawnIndex = index;
      }
    },
    [getLoadedFrame]
  );

  const calculateProgress = useCallback(() => {
    const innerHeight = window.innerHeight;
    const heroScrubDistance = Math.max(innerHeight * 1.6, 600);
    return Math.min(Math.max(window.scrollY / heroScrubDistance, 0), 1);
  }, []);

  useEffect(() => {
    const mobileQuery = window.innerWidth < 768;
    setIsMobile(mobileQuery);
    const dir = mobileQuery ? "/frames-mobile" : "/frames";
    frameDirRef.current = dir;

    if (posterRef.current) {
      posterRef.current.src = `${dir}/frame_001.webp`;
      posterRef.current.setAttribute("width", mobileQuery ? "606" : "1920");
      posterRef.current.setAttribute("height", "1080");
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let prefersReduced = motionQuery.matches;

    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const newIsMobile = window.innerWidth < 768;
      const naturalW = imagesRef.current[0]?.naturalWidth || (newIsMobile ? 606 : 1920);
      const naturalH = imagesRef.current[0]?.naturalHeight || 1080;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const displayW = window.innerWidth;
      const displayH = window.innerHeight;

      // Size backing store to displayed size times min(dpr, 2), capped at natural frame size * 1
      const scale = Math.min(dpr, naturalW / displayW, naturalH / displayH);
      canvas.width = Math.round(displayW * scale);
      canvas.height = Math.round(displayH * scale);

      // Resizing resets canvas context; re-enable high quality image smoothing
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
      }

      if (newIsMobile !== (frameDirRef.current === "/frames-mobile")) {
        const newDir = newIsMobile ? "/frames-mobile" : "/frames";
        frameDirRef.current = newDir;
        setIsMobile(newIsMobile);
        if (posterRef.current) {
          posterRef.current.src = `${newDir}/frame_001.webp`;
          posterRef.current.setAttribute("width", newIsMobile ? "606" : "1920");
          posterRef.current.setAttribute("height", "1080");
        }
        preload(newDir);
      } else if (lastDrawnIndexRef.current >= 0) {
        drawFrame(lastDrawnIndexRef.current);
      }
    };

    const tick = () => {
      if (prefersReduced) return;

      smoothedProgressRef.current +=
        (targetProgressRef.current - smoothedProgressRef.current) * 0.12;

      if (Math.abs(targetProgressRef.current - smoothedProgressRef.current) < 0.0001) {
        smoothedProgressRef.current = targetProgressRef.current;
      }

      const frameIndex = Math.min(
        Math.max(Math.round(smoothedProgressRef.current * (TOTAL_FRAMES - 1)), 0),
        TOTAL_FRAMES - 1
      );

      if (frameIndex !== lastDrawnIndexRef.current) {
        drawFrame(frameIndex);
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    const handleScroll = () => {
      targetProgressRef.current = calculateProgress();
    };

    const preload = (dir: string) => {
      const newImages = new Array(TOTAL_FRAMES);
      let loaded = 0;
      let initialTriggered = false;

      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const img = new Image();
        img.src = getFramePath(dir, i);

        const onDone = () => {
          loaded++;
          setLoadCount(loaded);
          if (loaded >= INITIAL_THRESHOLD && !initialTriggered) {
            initialTriggered = true;
            setIsReady(true);
            targetProgressRef.current = calculateProgress();
            smoothedProgressRef.current = targetProgressRef.current;

            if (prefersReduced) {
              drawFrame(0);
            } else {
              const initIndex = Math.min(
                Math.max(Math.round(smoothedProgressRef.current * (TOTAL_FRAMES - 1)), 0),
                TOTAL_FRAMES - 1
              );
              drawFrame(initIndex);
              if (!rafIdRef.current) {
                rafIdRef.current = requestAnimationFrame(tick);
              }
            }
          }
        };

        img.onload = onDone;
        img.onerror = onDone;
        newImages[i] = img;
      }
      imagesRef.current = newImages;
    };

    resizeCanvas();
    preload(dir);

    window.addEventListener("resize", resizeCanvas, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReduced = e.matches;
      if (prefersReduced) {
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        drawFrame(0);
      } else {
        targetProgressRef.current = calculateProgress();
        smoothedProgressRef.current = targetProgressRef.current;
        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(tick);
        }
      }
    };
    motionQuery.addEventListener("change", handleMotionChange);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("scroll", handleScroll);
      motionQuery.removeEventListener("change", handleMotionChange);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [calculateProgress, drawFrame, getFramePath]);

  return (
    <>
      {/* Full-bleed Canvas Backdrop */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[#0a0a0a] overflow-hidden" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={posterRef}
          src={isMobile ? "/frames-mobile/frame_001.webp" : "/frames/frame_001.webp"}
          width={isMobile ? 606 : 1920}
          height={1080}
          alt=""
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
        <canvas ref={canvasRef} id="hero-canvas" className="absolute inset-0 w-full h-full z-1 block" />
      </div>

      {/* Minimal Preload Indicator */}
      {!isReady && (
        <div
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-2 bg-[rgba(10,22,44,0.72)] backdrop-blur-md border border-[rgba(80,130,220,0.22)] rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.35)] pointer-events-none transition-all duration-300"
          role="status"
          aria-live="polite"
        >
          <span className="w-2 h-2 rounded-full bg-[#2f8cff] shadow-[0_0_10px_#2f8cff] animate-pulse" aria-hidden="true" />
          <span className="text-xs font-medium tracking-wide text-[#eaf1ff]">
            Loading frames ({loadCount}/{INITIAL_THRESHOLD})…
          </span>
        </div>
      )}
    </>
  );
}
