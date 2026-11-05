import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './FaceScanModel.css';

const REFERENCE_MODEL_HEIGHT = 632;

const faceLandmarks = [
  [-0.29, 0.69],
  [-0.15, 0.71],
  [0.15, 0.71],
  [0.29, 0.69],
  [-0.39, 0.51],
  [0.39, 0.51],
  [-0.2, 0.34],
  [0.2, 0.34],
  [0, 0.47],
] as const;

const createStudioEnvironment = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return undefined;

  // Soft icy-blue studio reflection with balanced contrast (prevents overexposure)
  const background = context.createLinearGradient(0, 0, 0, canvas.height);
  background.addColorStop(0, '#E8F2FA');
  background.addColorStop(0.35, '#CBE1F0');
  background.addColorStop(0.70, '#8AAEC6');
  background.addColorStop(1, '#4B708A');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const addSoftbox = (x: number, y: number, radius: number, color: string) => {
    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'transparent');
    context.fillStyle = glow;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  addSoftbox(256, 25, 130, 'rgba(255, 255, 255, 0.85)');
  addSoftbox(75, 115, 100, 'rgba(180, 215, 240, 0.5)');
  addSoftbox(435, 95, 90, 'rgba(150, 195, 225, 0.4)');

  const environment = new THREE.CanvasTexture(canvas);
  environment.mapping = THREE.EquirectangularReflectionMapping;
  environment.colorSpace = THREE.SRGBColorSpace;
  return environment;
};

const createTrackingTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return undefined;

  // Solid green #148F3A landmark dot
  const glow = context.createRadialGradient(32, 32, 1, 32, 32, 31);
  glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
  glow.addColorStop(0.18, 'rgba(20, 143, 58, 0.95)');
  glow.addColorStop(0.40, 'rgba(20, 143, 58, 0.5)');
  glow.addColorStop(1, 'rgba(20, 143, 58, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

export interface FaceScanModelProps {
  followPointer?: boolean;
  normalizeSize?: boolean;
  scaleMultiplier?: number;
}

export const FaceScanModel = ({
  followPointer = false,
  normalizeSize = false,
  scaleMultiplier = 1,
}: FaceScanModelProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0.015, 2.65);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch (error) {
      console.warn('Unable to initialize WebGL for the Aivora face model.', error);
      window.queueMicrotask(() => setLoadError(true));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.setClearColor(0xffffff, 0);
    renderer.domElement.className = 'face-scan-model-canvas';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute(
      'aria-label',
      followPointer
        ? 'Interactive 3D face model. Move the pointer or drag to rotate.'
        : 'Interactive 3D face model. Drag to rotate.'
    );
    container.appendChild(renderer.domElement);

    const environmentMap = createStudioEnvironment();
    if (environmentMap) scene.environment = environmentMap;

    // Directional sculpted lighting: realistic 3D depth, soft blue-grey shadows, no blowout
    scene.add(new THREE.HemisphereLight(0xF0F7FC, 0x7E9EB6, 0.65));
    const keyLight = new THREE.DirectionalLight(0xFFFFFF, 1.95);
    keyLight.position.set(2.2, 3.0, 3.2);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xB4D2E7, 0.65);
    fillLight.position.set(-2.8, 0.5, 2.0);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0x9EC4DE, 0.9);
    rimLight.position.set(-2.2, 1.8, -2.5);
    scene.add(rimLight);
    const bounceLight = new THREE.DirectionalLight(0x8EB0C8, 0.35);
    bounceLight.position.set(0, -2.2, 1.2);
    scene.add(bounceLight);

    const trackingTexture = createTrackingTexture();
    const trackingMaterial = trackingTexture
      ? new THREE.SpriteMaterial({
          map: trackingTexture,
          color: '#148F3A',
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      : undefined;
    const scanUniforms = { scanY: { value: 0 } };
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pivot = new THREE.Group();
    scene.add(pivot);

    const addFaceScanShader = (material: THREE.MeshPhysicalMaterial) => {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uFaceScanY = scanUniforms.scanY;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying float vAivoraFaceY;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAivoraFaceY = position.y;');
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            '#include <common>\nuniform float uFaceScanY;\nvarying float vAivoraFaceY;'
          )
          .replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            float aivoraScanDistance = abs(vAivoraFaceY - uFaceScanY);
            float aivoraScanLine = exp(-aivoraScanDistance * aivoraScanDistance * 18000.0);
            float aivoraGlow = exp(-aivoraScanDistance * aivoraScanDistance * 2200.0);
            totalEmissiveRadiance += vec3(0.08, 0.56, 0.23) * aivoraScanLine * 0.75;
            totalEmissiveRadiance += vec3(0.04, 0.35, 0.14) * aivoraGlow * 0.35;`
          );
      };
      material.customProgramCacheKey = () => 'medicure-face-porcelain-v3';
    };

    const rotationTarget = { x: 0, y: 0 };
    const modelBounds = new THREE.Box3();
    const modelBoundsSize = new THREE.Vector3();
    let activePointerId: number | null = null;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let animationFrame = 0;
    let lastFrameTime = 0;
    let disposed = false;
    let isInView = false;
    let modelRoot: THREE.Object3D | undefined;

    const render = (time: number) => {
      animationFrame = 0;
      if (disposed) return;

      const delta = lastFrameTime === 0 ? 1 / 60 : Math.min((time - lastFrameTime) / 1000, 0.05);
      lastFrameTime = time;
      const easing = 1 - Math.exp(-12 * delta);
      pivot.rotation.x += (rotationTarget.x - pivot.rotation.x) * easing;
      pivot.rotation.y += (rotationTarget.y - pivot.rotation.y) * easing;

      if (!prefersReducedMotion && isInView && modelRoot) {
        const scanProgress = (time % 5200) / 5200;
        const scanDirection = scanProgress < 0.5 ? scanProgress * 2 : (1 - scanProgress) * 2;
        scanUniforms.scanY.value = modelBounds.min.y + scanDirection * modelBoundsSize.y;
      }

      renderer.render(scene, camera);

      if (
        (!prefersReducedMotion && isInView && modelRoot) ||
        Math.abs(rotationTarget.x - pivot.rotation.x) > 0.001 ||
        Math.abs(rotationTarget.y - pivot.rotation.y) > 0.001
      ) {
        animationFrame = window.requestAnimationFrame(render);
      }
    };

    const scheduleRender = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      if (normalizeSize) {
        const framedHeight = Math.min(height, REFERENCE_MODEL_HEIGHT);
        camera.position.z = 2.65 * (height / framedHeight);
      }
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      scheduleRender();
    });
    resizeObserver.observe(container);

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isInView = entry.isIntersecting;
      if (isInView) scheduleRender();
    });
    visibilityObserver.observe(container);

    const canvas = renderer.domElement;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      activePointerId = event.pointerId;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      canvas.classList.add('is-dragging');
      canvas.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (activePointerId === null && followPointer && event.pointerType === 'mouse') {
        const horizontal = (event.clientX - rect.left) / rect.width;
        const vertical = (event.clientY - rect.top) / rect.height;
        rotationTarget.y = THREE.MathUtils.clamp((horizontal - 0.5) * 1.1, -0.55, 0.55);
        rotationTarget.x = THREE.MathUtils.clamp((0.5 - vertical) * 0.7, -0.35, 0.35);
        scheduleRender();
        return;
      }

      if (event.pointerId !== activePointerId) return;
      const deltaX = (event.clientX - lastPointerX) / rect.width;
      const deltaY = (event.clientY - lastPointerY) / rect.height;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      rotationTarget.y = THREE.MathUtils.clamp(rotationTarget.y + deltaX * Math.PI * 1.5, -1.2, 1.2);
      rotationTarget.x = THREE.MathUtils.clamp(rotationTarget.x + deltaY * Math.PI, -0.65, 0.65);
      scheduleRender();
    };

    const endPointer = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      canvas.classList.remove('is-dragging');
      if (followPointer) {
        rotationTarget.x = 0;
        rotationTarget.y = 0;
        scheduleRender();
      }
    };

    const handlePointerLeave = () => {
      if (!followPointer || activePointerId !== null) return;
      rotationTarget.x = 0;
      rotationTarget.y = 0;
      scheduleRender();
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', handlePointerLeave);

    const loader = new GLTFLoader();
    loader.load(
      '/aivora-face.glb',
      (gltf) => {
        if (disposed) {
          gltf.scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.geometry.dispose();
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              materials.forEach((material) => material.dispose());
            }
          });
          return;
        }

        const loadedModel = gltf.scene;
        modelRoot = loadedModel;
        loadedModel.updateMatrixWorld(true);
        modelBounds.setFromObject(loadedModel);
        const center = modelBounds.getCenter(new THREE.Vector3());
        modelBoundsSize.copy(modelBounds.getSize(new THREE.Vector3()));
        const centeredBounds = modelBounds.clone().translate(center.clone().negate());
        const scale = (1.15 * scaleMultiplier) / modelBoundsSize.y;
        loadedModel.position.sub(center);
        pivot.scale.setScalar(scale);
        pivot.add(loadedModel);
        pivot.updateMatrixWorld(true);

        const faceMeshes: THREE.Mesh[] = [];
        loadedModel.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          faceMeshes.push(object);
          object.castShadow = false;
          object.receiveShadow = false;
          const hasMaterialGroups = Array.isArray(object.material);
          const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
          const isEye = object.name.toLowerCase().includes('eye');
          const refinedMaterials = sourceMaterials.map((sourceMaterial) => {
            // Glossy porcelain white with visible icy-blue depth, sculpted anatomical shading
            const material = new THREE.MeshPhysicalMaterial({
              color: isEye ? '#B8D0E0' : '#D0E2EE',
              emissive: 0x000000,
              emissiveIntensity: 0,
              metalness: 0.03,
              roughness: isEye ? 0.12 : 0.20,
              clearcoat: 0.95,
              clearcoatRoughness: 0.07,
              ior: 1.50,
              reflectivity: 0.52,
              envMapIntensity: 0.45,
            });
            addFaceScanShader(material);
            sourceMaterial.dispose();
            return material;
          });
          object.material = hasMaterialGroups ? refinedMaterials : refinedMaterials[0];
        });

        if (trackingMaterial) {
          const raycaster = new THREE.Raycaster();
          const rayDirection = pivot.localToWorld(new THREE.Vector3(0, 0, -1))
            .sub(pivot.getWorldPosition(new THREE.Vector3()))
            .normalize();
          const markerRadius = 0.008 / scale;

          faceLandmarks.forEach(([horizontal, vertical]) => {
            const origin = pivot.localToWorld(
              new THREE.Vector3(
                horizontal * modelBoundsSize.x,
                centeredBounds.min.y + vertical * modelBoundsSize.y,
                centeredBounds.max.z + modelBoundsSize.z + 1
              )
            );
            raycaster.set(origin, rayDirection);
            const hit = raycaster.intersectObjects(faceMeshes, false)[0];
            if (!hit) return;

            const marker = new THREE.Sprite(trackingMaterial);
            marker.position.copy(loadedModel.worldToLocal(hit.point.clone()));
            marker.position.addScaledVector(
              hit.face?.normal ?? new THREE.Vector3(0, 0, 1),
              0.002
            );
            marker.scale.set(markerRadius * 4, markerRadius * 4, 1);
            loadedModel.add(marker);
          });
        }

        scheduleRender();
      },
      undefined,
      (error) => {
        if (disposed) return;
        console.error('Failed to load the Aivora face model.', error);
        setLoadError(true);
      }
    );

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', endPointer);
      canvas.removeEventListener('pointercancel', endPointer);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      if (modelRoot) {
        modelRoot.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => material.dispose());
          }
        });
      }
      trackingMaterial?.dispose();
      trackingTexture?.dispose();
      environmentMap?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [followPointer, normalizeSize, scaleMultiplier]);

  return (
    <div ref={containerRef} className="face-scan-model">
      {/* Subtle circular scanning ring positioned strictly behind the 3D face */}
      <div className="face-scan-radar-circle" aria-hidden="true" />

      {/* Symmetrical 4 green scanning corner brackets aligned outside the face boundaries */}
      <div className="face-scan-frame" aria-hidden="true">
        <div className="face-scan-bracket-tl" />
        <div className="face-scan-bracket-tr" />
        <div className="face-scan-bracket-bl" />
        <div className="face-scan-bracket-br" />
      </div>

      {loadError && (
        <p className="face-scan-model-error" role="alert">
          The 3D face model could not be loaded.
        </p>
      )}
    </div>
  );
};
