import { useEffect, useRef, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  pulse: number;
  pulseSpeed: number;
}

/**
 * AMOLED auth background with floating glowing particles
 * matching the app's primary red accent and brutal aesthetic.
 */
export function AuthBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const animRef = useRef<number>(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current = {
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    // App primary hue (red/orange from --primary: 0 72% 60%)
    const PRIMARY_HUE = 0;
    const PARTICLE_COUNT = Math.min(50, Math.floor((w * h) / 25000));

    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.4 + 0.1,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.005,
      });
    }

    // Floating orbs (larger, slower, ambient glow)
    const orbs: { x: number; y: number; r: number; vx: number; vy: number; hue: number }[] = [];
    for (let i = 0; i < 4; i++) {
      orbs.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 120 + 80,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        hue: PRIMARY_HUE + (Math.random() - 0.5) * 20,
      });
    }

    let time = 0;
    let mouseX = w / 2;
    let mouseY = h / 2;

    function draw() {
      time += 0.005;

      // Smooth mouse tracking
      const targetMX = mouseRef.current.x * w;
      const targetMY = mouseRef.current.y * h;
      mouseX += (targetMX - mouseX) * 0.03;
      mouseY += (targetMY - mouseY) * 0.03;

      // AMOLED black background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);

      // Ambient floating orbs
      for (const orb of orbs) {
        orb.x += orb.vx;
        orb.y += orb.vy;

        // Soft bounce
        if (orb.x < -orb.r) orb.x = w + orb.r;
        if (orb.x > w + orb.r) orb.x = -orb.r;
        if (orb.y < -orb.r) orb.y = h + orb.r;
        if (orb.y > h + orb.r) orb.y = -orb.r;

        // Mouse repulsion
        const odx = orb.x - mouseX;
        const ody = orb.y - mouseY;
        const odist = Math.sqrt(odx * odx + ody * ody);
        if (odist < 300) {
          const force = (300 - odist) / 300 * 0.3;
          orb.x += (odx / odist) * force;
          orb.y += (ody / odist) * force;
        }

        const orbAlpha = 0.03 + Math.sin(time * 0.5 + orb.hue) * 0.01;
        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        grad.addColorStop(0, `hsla(${orb.hue}, 80%, 50%, ${orbAlpha})`);
        grad.addColorStop(0.5, `hsla(${orb.hue}, 70%, 40%, ${orbAlpha * 0.4})`);
        grad.addColorStop(1, `hsla(${orb.hue}, 60%, 30%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Update & draw particles
      for (const p of particles) {
        p.pulse += p.pulseSpeed;
        p.x += p.vx + Math.sin(time + p.y * 0.005) * 0.15;
        p.y += p.vy + Math.cos(time + p.x * 0.005) * 0.1;

        // Mouse attraction (subtle)
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 250 && dist > 0) {
          const force = (250 - dist) / 250 * 0.08;
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        }

        // Wrap edges
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        const pulseAlpha = p.opacity * (0.6 + Math.sin(p.pulse) * 0.4);
        const size = p.size * (1 + Math.sin(p.pulse) * 0.2);

        // Glow
        const glowSize = size * 6;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        glow.addColorStop(0, `hsla(${PRIMARY_HUE}, 80%, 60%, ${pulseAlpha * 0.25})`);
        glow.addColorStop(1, `hsla(${PRIMARY_HUE}, 80%, 50%, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = `hsla(${PRIMARY_HUE}, 75%, 65%, ${pulseAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw connections between nearby particles
      ctx.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            const alpha = 0.06 * (1 - dist / 150);
            ctx.strokeStyle = `hsla(${PRIMARY_HUE}, 60%, 55%, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Subtle grid overlay (matching canvas dots pattern)
      ctx.fillStyle = `hsla(${PRIMARY_HUE}, 70%, 50%, 0.015)`;
      const gridSize = 40;
      for (let gx = gridSize; gx < w; gx += gridSize) {
        for (let gy = gridSize; gy < h; gy += gridSize) {
          ctx.beginPath();
          ctx.arc(gx, gy, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Vignette
      const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.75);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    const onResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}
