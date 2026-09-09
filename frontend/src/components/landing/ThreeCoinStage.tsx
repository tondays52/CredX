import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeCoinStageProps {
  className?: string;
}

export const ThreeCoinStage: React.FC<ThreeCoinStageProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Scene & Camera setup matching the provided Three.js code
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 11);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);

    // Neon Green Ambient & Point Lights
    scene.add(new THREE.AmbientLight(0x203020, 1.4));
    const key = new THREE.PointLight(0x4fff85, 2.6, 45);
    key.position.set(4, 5, 8);
    scene.add(key);

    const rim = new THREE.PointLight(0x2fae66, 1.8, 45);
    rim.position.set(-6, -3, 4);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);

    const coins: THREE.Mesh[] = [];
    const count = 12;

    // Cryptographic symbols including Bitcoin, Ethereum, Creditcoin (CTC), Solana, etc.
    const symbols = ['\u20BF', '\u039E', 'CTC', '\u25C6', '\u0141', '\u0110', '\u20AE', '\u2206', '\u03A9', '\u2B21'];

    function makeSideMaterial() {
      return new THREE.MeshStandardMaterial({
        color: 0x1c2a1f,
        metalness: 0.85,
        roughness: 0.28,
        emissive: 0x2fae66,
        emissiveIntensity: 0.35
      });
    }

    function makeFaceTexture(symbol: string) {
      const size = 256;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      if (!ctx) return new THREE.CanvasTexture(c);

      const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
      grad.addColorStop(0, '#243728');
      grad.addColorStop(1, '#0e1410');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(79,255,133,0.55)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 9, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#8dffb0';
      ctx.shadowColor = '#4fff85';
      ctx.shadowBlur = 20;
      ctx.font = symbol.length > 2 ? '700 76px "Space Grotesk", sans-serif' : '700 118px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, size / 2, size / 2 + 6);

      const tex = new THREE.CanvasTexture(c);
      tex.anisotropy = 4;
      return tex;
    }

    function makeFaceMaterial(symbol: string) {
      return new THREE.MeshStandardMaterial({
        map: makeFaceTexture(symbol),
        metalness: 0.6,
        roughness: 0.35,
        emissive: 0x2fae66,
        emissiveIntensity: 0.2
      });
    }

    for (let i = 0; i < count; i++) {
      const radius = 0.85 + Math.random() * 0.5;
      const depth = 0.14;
      const geo = new THREE.CylinderGeometry(radius, radius, depth, 40);
      const symbol = symbols[i % symbols.length];
      const faceMat = makeFaceMaterial(symbol);
      // Cylinder material groups: [0] side, [1] top cap, [2] bottom cap
      const coin = new THREE.Mesh(geo, [makeSideMaterial(), faceMat, faceMat]);

      // Edge ring for a bit of definition
      const edgeGeo = new THREE.TorusGeometry(radius * 0.99, 0.02, 8, 40);
      const edgeMat = new THREE.MeshBasicMaterial({ color: 0x4fff85, transparent: true, opacity: 0.55 });
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.rotation.x = Math.PI / 2;
      coin.add(edge);

      const spread = 5.4;
      coin.position.set(
        (Math.random() - 0.5) * spread * 2.2,
        (Math.random() - 0.5) * spread * 1.1,
        (Math.random() - 0.5) * 4.0
      );
      coin.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      coin.userData = {
        spinX: (Math.random() - 0.5) * 0.006,
        spinY: 0.004 + Math.random() * 0.006,
        floatSpeed: 0.4 + Math.random() * 0.5,
        floatOffset: Math.random() * Math.PI * 2,
        baseY: coin.position.y
      };

      coins.push(coin);
      group.add(coin);
    }

    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseX = (e.clientX - rect.left) / rect.width - 0.5;
      mouseY = (e.clientY - rect.top) / rect.height - 0.5;
    };
    container.addEventListener('mousemove', handleMouseMove);

    const clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      coins.forEach((c) => {
        const d = c.userData;
        if (!reduceMotion) {
          c.rotation.x += d.spinX;
          c.rotation.y += d.spinY;
          c.position.y = d.baseY + Math.sin(t * d.floatSpeed + d.floatOffset) * 0.28;
        }
      });

      if (!reduceMotion) {
        group.rotation.y += (mouseX * 0.4 - group.rotation.y) * 0.03;
        group.rotation.x += (mouseY * 0.2 - group.rotation.x) * 0.03;
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  return (
    <div className={`relative w-full h-full pointer-events-none select-none ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

export default ThreeCoinStage;
