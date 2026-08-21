import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const ShieldScene: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const width = container.clientWidth || 550;
    const height = container.clientHeight || 500;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 14);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';

    // Particle Texture
    const createParticleTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };

    const particleTexture = createParticleTexture();

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 1. Generate 3D Shield Point Cloud
    const shieldPoints: THREE.Vector3[] = [];
    const shieldColors: number[] = [];

    const isInsideShield = (x: number, y: number) => {
      // y from -3 to 3.5
      // top width ~ 2.4, narrows to point at bottom y = -3
      if (y > 3.2 || y < -3.2) return false;
      
      let maxWidth: number;
      if (y > 1.5) {
        // slight top curve
        const topFactor = (y - 1.5) / 1.7;
        maxWidth = 2.4 - topFactor * topFactor * 0.4;
      } else {
        // taper down to bottom tip
        const bottomFactor = (1.5 - y) / 4.7;
        maxWidth = 2.4 * Math.max(0, 1 - Math.pow(bottomFactor, 1.3));
      }
      return Math.abs(x) <= maxWidth;
    };

    // Grid sampling for the shield surface
    const step = 0.15;
    for (let y = -3.2; y <= 3.2; y += step) {
      for (let x = -2.8; x <= 2.8; x += step) {
        if (isInsideShield(x, y)) {
          // Add 3D bevel / center crease
          const distFromCenter = Math.abs(x);
          const zDepth = (1.2 - distFromCenter * 0.45) * Math.cos((y / 3.5) * 0.8);
          
          // Outer border points vs interior points
          const isBorder = !isInsideShield(x + step * 0.9, y) || 
                           !isInsideShield(x - step * 0.9, y) || 
                           !isInsideShield(x, y + step * 0.9) || 
                           !isInsideShield(x, y - step * 0.9);

          shieldPoints.push(new THREE.Vector3(x, y, zDepth * 0.8));

          // Border is brighter white, center crease has warm ember hints
          if (isBorder) {
            shieldColors.push(1.0, 1.0, 1.0);
          } else if (distFromCenter < 0.2) {
            shieldColors.push(1.0, 0.7, 0.5);
          } else {
            shieldColors.push(0.7, 0.75, 0.85);
          }

          // Double layer for back/thickness
          if (isBorder) {
            shieldPoints.push(new THREE.Vector3(x, y, zDepth * 0.8 - 0.25));
            shieldColors.push(0.6, 0.65, 0.75);
          }
        }
      }
    }

    const shieldGeometry = new THREE.BufferGeometry().setFromPoints(shieldPoints);
    shieldGeometry.setAttribute('color', new THREE.Float32BufferAttribute(shieldColors, 3));

    const shieldMaterial = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      map: particleTexture || undefined,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const shieldMesh = new THREE.Points(shieldGeometry, shieldMaterial);
    rootGroup.add(shieldMesh);

    // 2. Dual Elliptical Orbital Particle Rings
    const ringGroup = new THREE.Group();
    rootGroup.add(ringGroup);

    // Ring 1 (Inner Dense Ring)
    const ring1Count = 450;
    const ring1Points: THREE.Vector3[] = [];
    const ring1Colors: number[] = [];

    for (let i = 0; i < ring1Count; i++) {
      const angle = (i / ring1Count) * Math.PI * 2;
      const radiusX = 4.6 + (Math.random() - 0.5) * 0.35;
      const radiusY = 2.4 + (Math.random() - 0.5) * 0.25;
      const x = Math.cos(angle) * radiusX;
      const y = Math.sin(angle) * radiusY;
      const z = (Math.random() - 0.5) * 0.4;

      ring1Points.push(new THREE.Vector3(x, y, z));

      const isOrange = Math.random() < 0.25;
      if (isOrange) {
        ring1Colors.push(1.0, 0.3, 0.1); // #FF4D22
      } else {
        ring1Colors.push(0.85, 0.85, 0.95);
      }
    }

    const ring1Geometry = new THREE.BufferGeometry().setFromPoints(ring1Points);
    ring1Geometry.setAttribute('color', new THREE.Float32BufferAttribute(ring1Colors, 3));

    const ring1Material = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      map: particleTexture || undefined,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const ring1Mesh = new THREE.Points(ring1Geometry, ring1Material);
    ringGroup.add(ring1Mesh);

    // Ring 2 (Outer Fainter Ring)
    const ring2Count = 350;
    const ring2Points: THREE.Vector3[] = [];
    const ring2Colors: number[] = [];

    for (let i = 0; i < ring2Count; i++) {
      const angle = (i / ring2Count) * Math.PI * 2;
      const radiusX = 5.8 + (Math.random() - 0.5) * 0.5;
      const radiusY = 3.1 + (Math.random() - 0.5) * 0.35;
      const x = Math.cos(angle) * radiusX;
      const y = Math.sin(angle) * radiusY;
      const z = (Math.random() - 0.5) * 0.5;

      ring2Points.push(new THREE.Vector3(x, y, z));

      const isOrange = Math.random() < 0.35;
      if (isOrange) {
        ring2Colors.push(1.0, 0.4, 0.15);
      } else {
        ring2Colors.push(0.6, 0.65, 0.75);
      }
    }

    const ring2Geometry = new THREE.BufferGeometry().setFromPoints(ring2Points);
    ring2Geometry.setAttribute('color', new THREE.Float32BufferAttribute(ring2Colors, 3));

    const ring2Material = new THREE.PointsMaterial({
      size: 0.11,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      map: particleTexture || undefined,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const ring2Mesh = new THREE.Points(ring2Geometry, ring2Material);
    ringGroup.add(ring2Mesh);

    // Tilt the orbital rings
    ringGroup.rotation.x = Math.PI * 0.32;
    ringGroup.rotation.y = -Math.PI * 0.12;
    ringGroup.rotation.z = Math.PI * 0.05;

    // 3. Ambient Ember Sparks
    const emberCount = 180;
    const emberPoints: THREE.Vector3[] = [];
    const emberColors: number[] = [];

    for (let i = 0; i < emberCount; i++) {
      const x = (Math.random() - 0.5) * 12;
      const y = (Math.random() - 0.5) * 9;
      const z = (Math.random() - 0.5) * 8;
      emberPoints.push(new THREE.Vector3(x, y, z));

      const isOrange = Math.random() < 0.4;
      if (isOrange) {
        emberColors.push(1.0, 0.35, 0.12);
      } else {
        emberColors.push(0.5, 0.55, 0.65);
      }
    }

    const emberGeometry = new THREE.BufferGeometry().setFromPoints(emberPoints);
    emberGeometry.setAttribute('color', new THREE.Float32BufferAttribute(emberColors, 3));

    const emberMaterial = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      map: particleTexture || undefined,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const emberMesh = new THREE.Points(emberGeometry, emberMaterial);
    rootGroup.add(emberMesh);

    // Mouse Interaction
    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetRotY = x * 0.35;
      targetRotX = -y * 0.25;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Resize Observer
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

    // Animation loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      currentRotX += (targetRotX - currentRotX) * 0.05;
      currentRotY += (targetRotY - currentRotY) * 0.05;

      if (!prefersReducedMotion) {
        // Slow rotation of rings
        ringGroup.rotation.z = Math.PI * 0.05 + elapsed * 0.08;

        // Subtle shield breathing
        shieldMesh.position.y = Math.sin(elapsed * 1.2) * 0.08;

        // Ambient ember slow drift
        emberMesh.rotation.y = elapsed * 0.02;
      }

      rootGroup.rotation.x = currentRotX;
      rootGroup.rotation.y = currentRotY;

      renderer?.render(scene, camera);
    };

    animate();

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

      shieldGeometry.dispose();
      shieldMaterial.dispose();
      ring1Geometry.dispose();
      ring1Material.dispose();
      ring2Geometry.dispose();
      ring2Material.dispose();
      emberGeometry.dispose();
      emberMaterial.dispose();
      particleTexture?.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-[400px] sm:h-[480px] lg:h-[540px] flex items-center justify-center relative select-none pointer-events-none"
      aria-hidden="true"
    />
  );
};
