import { useEffect, useRef, useCallback } from 'react';

interface Particle3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  opacity: number;
  hue: number;
}

/**
 * 3D floating neural network animation for auth pages.
 * Pure canvas — no dependencies.
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

    // Detect theme
    const isDark = document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Colors
    const primaryHue = 250; // purple/blue
    const accentHue = 200; // cyan
    const particleColor = isDark ? 'hsla' : 'hsla';
    const lineAlpha = isDark ? 0.08 : 0.06;
    const particleAlpha = isDark ? 0.5 : 0.35;
    const bgGradient1 = isDark ? 'rgba(10, 10, 20, 0.95)' : 'rgba(245, 245, 250, 0.97)';
    const bgGradient2 = isDark ? 'rgba(20, 10, 40, 0.9)' : 'rgba(240, 235, 250, 0.95)';

    // Create particles
    const PARTICLE_COUNT = 60;
    const particles: Particle3D[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 600,
        y: (Math.random() - 0.5) * 600,
        z: (Math.random() - 0.5) * 600,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        vz: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2.5 + 1,
        opacity: Math.random() * 0.4 + 0.1,
        hue: Math.random() > 0.5 ? primaryHue : accentHue,
      });
    }

    // 3D projection
    const fov = 500;
    let rotationY = 0;
    let rotationX = 0;

    function project(p: Particle3D): { sx: number; sy: number; scale: number } {
      // Apply mouse-driven rotation
      const cosY = Math.cos(rotationY);
      const sinY = Math.sin(rotationY);
      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);

      // Rotate Y
      const x1 = p.x * cosY - p.z * sinY;
      const z1 = p.x * sinY + p.z * cosY;

      // Rotate X
      const y2 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;

      const scale = fov / (fov + z2 + 400);
      const sx = x1 * scale + w / 2;
      const sy = y2 * scale + h / 2;

      return { sx, sy, scale };
    }

    let time = 0;

    function draw() {
      time += 0.003;

      // Smooth rotation from mouse
      const targetRotY = (mouseRef.current.x - 0.5) * 0.4;
      const targetRotX = (mouseRef.current.y - 0.5) * 0.25;
      rotationY += (targetRotY - rotationY) * 0.02;
      rotationX += (targetRotX - rotationX) * 0.02;

      // Auto-rotate
      rotationY += 0.001;

      // Background gradient
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      grad.addColorStop(0, bgGradient2);
      grad.addColorStop(1, bgGradient1);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Update particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Bounce off bounds
        const bound = 350;
        if (p.x > bound || p.x < -bound) p.vx *= -1;
        if (p.y > bound || p.y < -bound) p.vy *= -1;
        if (p.z > bound || p.z < -bound) p.vz *= -1;

        // Subtle wave
        p.y += Math.sin(time + p.x * 0.01) * 0.15;
        p.x += Math.cos(time + p.z * 0.01) * 0.1;
      }

      // Sort by Z for painter's algorithm
      const projected = particles.map(p => ({ p, ...project(p) }));
      projected.sort((a, b) => {
        const za = a.p.x * Math.sin(rotationY) + a.p.z * Math.cos(rotationY);
        const zb = b.p.x * Math.sin(rotationY) + b.p.z * Math.cos(rotationY);
        return za - zb;
      });

      // Draw connections
      ctx.lineWidth = 0.8;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const a = projected[i];
          const b = projected[j];
          const dx = a.sx - b.sx;
          const dy = a.sy - b.sy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 180) {
            const alpha = lineAlpha * (1 - dist / 180) * a.scale * b.scale;
            const hue = (a.p.hue + b.p.hue) / 2;
            ctx.strokeStyle = `hsla(${hue}, 70%, 60%, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const { p, sx, sy, scale } of projected) {
        const size = p.size * scale * 2;
        const alpha = p.opacity * particleAlpha * (0.5 + scale * 0.5);

        // Glow
        const glowGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, size * 3);
        glowGrad.addColorStop(0, `hsla(${p.hue}, 80%, 65%, ${alpha * 0.5})`);
        glowGrad.addColorStop(1, `hsla(${p.hue}, 80%, 65%, 0)`);
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(sx, sy, size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }

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
