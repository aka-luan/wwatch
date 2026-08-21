import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const HeroThreeScene: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07080b, 0.032);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 18);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      // Fallback if WebGL fails
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Canvas styling
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';

    // Particle Texture Generator (soft glowing circle)
    const createCircleTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.7)');
      gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.15)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };

    const circleTexture = createCircleTexture();

    // 1. Deep Field Particles (Monochrome & Warm Ember Dust)
    const particleCount = prefersReducedMotion ? 400 : 1200;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const colorWhite = new THREE.Color(0xffffff);
    const colorDim = new THREE.Color(0x71717a);
    const colorOrange = new THREE.Color(0xff4d22);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Spread across deep space, bias towards right and back
      positions[i3] = (Math.random() - 0.4) * 32;
      positions[i3 + 1] = (Math.random() - 0.5) * 22;
      positions[i3 + 2] = (Math.random() - 0.5) * 24 - 2;

      // Occasional orange signal ember (1 in 15), else monochrome
      const isOrange = Math.random() < 0.08;
      const isDim = Math.random() < 0.7;
      const chosenColor = isOrange ? colorOrange : (isDim ? colorDim : colorWhite);

      colors[i3] = chosenColor.r;
      colors[i3 + 1] = chosenColor.g;
      colors[i3 + 2] = chosenColor.b;

      sizes[i] = isOrange ? Math.random() * 0.28 + 0.15 : Math.random() * 0.15 + 0.06;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      map: circleTexture || undefined,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // 2. Orbital Monitoring Signal Rings (Tilted Elliptical Paths)
    const ringGroup = new THREE.Group();
    ringGroup.position.set(4.5, 0.5, -2);
    ringGroup.rotation.x = Math.PI * 0.28;
    ringGroup.rotation.y = -Math.PI * 0.15;
    scene.add(ringGroup);

    // Elliptical ring paths
    const ringCount = 2;
    const ringPointsCount = 220;
    const ringMaterials: THREE.LineBasicMaterial[] = [];

    for (let r = 0; r < ringCount; r++) {
      const ringRadiusX = 5.5 + r * 1.8;
      const ringRadiusY = 3.2 + r * 1.0;
      const curvePoints: THREE.Vector3[] = [];

      for (let p = 0; p <= ringPointsCount; p++) {
        const theta = (p / ringPointsCount) * Math.PI * 2;
        curvePoints.push(
          new THREE.Vector3(
            Math.cos(theta) * ringRadiusX,
            Math.sin(theta) * ringRadiusY,
            Math.sin(theta * 2) * 0.4
          )
        );
      }

      const ringGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const ringMaterial = new THREE.LineBasicMaterial({
        color: r === 0 ? 0xffffff : 0xff4d22,
        transparent: true,
        opacity: r === 0 ? 0.18 : 0.25,
        blending: THREE.AdditiveBlending,
      });
      ringMaterials.push(ringMaterial);

      const ringLine = new THREE.Line(ringGeometry, ringMaterial);
      ringGroup.add(ringLine);
    }

    // 3. Network Signal Pulses (Travelling along curved spline paths)
    const splineCurves: THREE.CatmullRomCurve3[] = [];
    const splineCount = 5;
    const nodeAnchors: THREE.Vector3[] = [
      new THREE.Vector3(1, -2, -3),
      new THREE.Vector3(3, 1, -1),
      new THREE.Vector3(6, 2.5, -4),
      new THREE.Vector3(5, -2, -2),
      new THREE.Vector3(8, -0.5, -5),
      new THREE.Vector3(2, 3, -3),
    ];

    for (let i = 0; i < splineCount; i++) {
      const p1 = nodeAnchors[i % nodeAnchors.length];
      const p2 = nodeAnchors[(i + 1) % nodeAnchors.length];
      if (!p1 || !p2) continue;
      const mid = new THREE.Vector3(
        (p1.x + p2.x) / 2 + (Math.random() - 0.5) * 2,
        (p1.y + p2.y) / 2 + (Math.random() - 0.5) * 2,
        (p1.z + p2.z) / 2 + (Math.random() - 0.5) * 2
      );
      const curve = new THREE.CatmullRomCurve3([p1, mid, p2]);
      splineCurves.push(curve);

      // Render faint curve track
      const curvePoints = curve.getPoints(40);
      const trackGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const trackMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
      });
      const trackLine = new THREE.Line(trackGeometry, trackMaterial);
      scene.add(trackLine);
    }

    // Signal Packets
    const pulseCount = 12;
    const pulseGeometry = new THREE.BufferGeometry();
    const pulsePositions = new Float32Array(pulseCount * 3);
    const pulseColors = new Float32Array(pulseCount * 3);

    for (let i = 0; i < pulseCount; i++) {
      const isOrange = i % 2 === 0;
      const c = isOrange ? colorOrange : colorWhite;
      pulseColors[i * 3] = c.r;
      pulseColors[i * 3 + 1] = c.g;
      pulseColors[i * 3 + 2] = c.b;
    }

    pulseGeometry.setAttribute('position', new THREE.BufferAttribute(pulsePositions, 3));
    pulseGeometry.setAttribute('color', new THREE.BufferAttribute(pulseColors, 3));

    const pulseMaterial = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      map: circleTexture || undefined,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const pulsePoints = new THREE.Points(pulseGeometry, pulseMaterial);
    scene.add(pulsePoints);

    // Mouse Parallax
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetMouseX = x * 0.8;
      targetMouseY = y * 0.6;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    // Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse interpolation
      currentMouseX += (targetMouseX - currentMouseX) * 0.04;
      currentMouseY += (targetMouseY - currentMouseY) * 0.04;

      if (!prefersReducedMotion) {
        // Slow atmospheric rotation
        particles.rotation.y = elapsedTime * 0.02 + currentMouseX * 0.15;
        particles.rotation.x = Math.sin(elapsedTime * 0.015) * 0.05 + currentMouseY * 0.1;

        ringGroup.rotation.z = elapsedTime * 0.04;
        ringGroup.rotation.y = -Math.PI * 0.15 + currentMouseX * 0.1;

        // Animate signal pulses along network splines
        if (splineCurves.length > 0) {
          const posAttr = pulseGeometry.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < pulseCount; i++) {
            const curve = splineCurves[i % splineCurves.length];
            if (!curve) continue;
            const speed = 0.12 + (i % 3) * 0.05;
            const t = (elapsedTime * speed + i / pulseCount) % 1;
            const point = curve.getPoint(t);
            posAttr.setXYZ(i, point.x, point.y, point.z);
          }
          posAttr.needsUpdate = true;
        }
      }

      camera.position.x = currentMouseX * 1.2;
      camera.position.y = currentMouseY * 1.0;
      camera.lookAt(0, 0, 0);

      renderer?.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);

      if (renderer) {
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      }

      particleGeometry.dispose();
      particleMaterial.dispose();
      pulseGeometry.dispose();
      pulseMaterial.dispose();
      circleTexture?.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
      style={{
        maskImage: 'radial-gradient(ellipse 90% 80% at 65% 45%, black 40%, transparent 85%)',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 65% 45%, black 40%, transparent 85%)',
      }}
      aria-hidden="true"
    />
  );
};
