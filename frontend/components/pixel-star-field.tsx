"use client";

import { useEffect, useRef } from "react";

type PixelStar = {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
  baseAlpha: number;
  color: string;
};

type ShootingStar = {
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  startAt: number;
  duration: number;
};

const starColors = ["112,78,196", "38,105,186", "194,66,59", "111,143,28"];

function randomSource(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function createStars(count: number): PixelStar[] {
  const random = randomSource(92341 + count);

  return Array.from({ length: count }, () => {
    const colorIndex = Math.floor(random() * starColors.length);
    return {
      x: random(),
      y: random(),
      size: random() < 0.22 ? 10 : 7,
      phase: random() * Math.PI * 2,
      speed: 0.0018 + random() * 0.0028,
      baseAlpha: 0.82 + random() * 0.12,
      color: starColors[colorIndex],
    };
  });
}

export function PixelStarField() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!field || !canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 640px)");
    let width = 0;
    let height = 0;
    let stars: PixelStar[] = [];
    let shootingStars: ShootingStar[] = [];
    let nextShootingStarAt = 0;
    let animationFrame = 0;
    let lastFrameAt = 0;
    let isVisible = false;

    const clearCanvas = () => {
      context.clearRect(0, 0, width, height);
    };

    const drawStars = (time: number, isStatic: boolean) => {
      clearCanvas();

      for (const star of stars) {
        const twinkle = isStatic ? 0.55 : (Math.sin(time * star.speed + star.phase) + 1) / 2;
        const alpha = isStatic ? star.baseAlpha + 0.14 : 0.42 + twinkle * 0.58;
        const x = Math.round((star.x * width) / 2) * 2;
        const y = Math.round((star.y * height) / 2) * 2;
        context.fillStyle = `rgba(${star.color}, ${alpha})`;
        context.fillRect(x, y, star.size, star.size);
        context.fillStyle = `rgba(255, 255, 255, ${Math.min(alpha + 0.12, 1)})`;
        context.fillRect(x + Math.floor((star.size - 4) / 2), y + Math.floor((star.size - 4) / 2), 4, 4);
      }

      if (isStatic) return;

      shootingStars = shootingStars.filter((shootingStar) => {
        const progress = (time - shootingStar.startAt) / shootingStar.duration;
        if (progress >= 1) return false;
        const headX = shootingStar.startX + shootingStar.deltaX * progress;
        const headY = shootingStar.startY + shootingStar.deltaY * progress;
        const snappedHeadX = Math.round(headX / 2) * 2;
        const snappedHeadY = Math.round(headY / 2) * 2;
        const distance = Math.hypot(shootingStar.deltaX, shootingStar.deltaY);
        const unitX = shootingStar.deltaX / distance;
        const unitY = shootingStar.deltaY / distance;
        for (let pixel = 0; pixel < 18; pixel += 1) {
          const trailAlpha = (1 - progress) * (1 - pixel / 19) * 0.9;
          const trailSize = pixel < 3 ? 10 : 6;
          context.fillStyle = `rgba(${pixel === 0 ? starColors[2] : starColors[1]}, ${trailAlpha})`;
          context.fillRect(
            Math.round((headX - unitX * pixel * 10) / 2) * 2,
            Math.round((headY - unitY * pixel * 10) / 2) * 2,
            trailSize,
            trailSize,
          );
        }
        context.fillStyle = `rgba(255, 255, 255, ${(1 - progress) * 0.98})`;
        context.fillRect(snappedHeadX + 3, snappedHeadY + 3, 4, 4);
        return true;
      });
    };

    const drawStatic = () => {
      if (width && height) drawStars(0, true);
    };

    const resize = () => {
      const bounds = field.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      const starCount = mobile.matches
        ? 18
        : Math.min(92, Math.max(42, Math.round((width * height) / 28000)));
      stars = createStars(starCount);
      shootingStars = [];
      nextShootingStarAt = performance.now() + 1800 + Math.random() * 1800;
      drawStatic();
    };

    const spawnShootingStar = (time: number) => {
      const edge = Math.floor(Math.random() * 4);
      const padding = 24;
      let startX = Math.random() * width;
      let startY = Math.random() * height;
      let angle = Math.random() * Math.PI * 2;

      if (edge === 0) {
        startY = -padding;
        angle = Math.PI * (0.12 + Math.random() * 0.76);
      } else if (edge === 1) {
        startX = width + padding;
        angle = Math.PI * (0.62 + Math.random() * 0.76);
      } else if (edge === 2) {
        startY = height + padding;
        angle = -Math.PI * (0.12 + Math.random() * 0.76);
      } else {
        startX = -padding;
        angle = Math.PI * (-0.38 + Math.random() * 0.76);
      }

      const travelDistance = Math.hypot(width, height) * (0.65 + Math.random() * 0.45);
      shootingStars.push({
        startX,
        startY,
        deltaX: Math.cos(angle) * travelDistance,
        deltaY: Math.sin(angle) * travelDistance,
        startAt: time,
        duration: 4200 + Math.random() * 1800,
      });
      nextShootingStarAt = time + 900 + Math.random() * 600;
    };

    const animate = (time: number) => {
      animationFrame = 0;
      if (time - lastFrameAt < 30) {
        animationFrame = window.requestAnimationFrame(animate);
        return;
      }
      lastFrameAt = time;

      if (time >= nextShootingStarAt && shootingStars.length < (mobile.matches ? 5 : 10)) {
        spawnShootingStar(time);
      }
      drawStars(time, false);
      animationFrame = window.requestAnimationFrame(animate);
    };

    const stopAnimation = (clear = true) => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      if (clear) clearCanvas();
    };

    const syncAnimation = () => {
      if (reducedMotion.matches) {
        stopAnimation(false);
        if (isVisible && !document.hidden) drawStatic();
        return;
      }

      if (isVisible && !document.hidden) {
        if (!animationFrame) {
          shootingStars = [];
          nextShootingStarAt = performance.now() + 250 + Math.random() * 250;
          animationFrame = window.requestAnimationFrame(animate);
        }
      } else {
        stopAnimation(false);
        drawStatic();
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      syncAnimation();
    });
    const resizeObserver = new ResizeObserver(resize);
    const handleVisibility = () => syncAnimation();
    const handleMotionPreference = () => syncAnimation();
    const handleMobileChange = () => resize();

    resizeObserver.observe(field);
    observer.observe(field);
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotion.addEventListener("change", handleMotionPreference);
    mobile.addEventListener("change", handleMobileChange);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", handleMotionPreference);
      mobile.removeEventListener("change", handleMobileChange);
      stopAnimation();
    };
  }, []);

  return (
    <div aria-hidden="true" className="pixel-star-field" ref={fieldRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}
