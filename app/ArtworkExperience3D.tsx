"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import type * as ThreeTypes from "three";
import type { CuratedArtworkImage } from "./artworkImages";
import { publicAsset } from "./publicAsset";

type Artwork3D = {
  code: string;
  title: string;
  palette: string;
  dimensions?: string;
  price_cents?: number;
};

type Props = {
  work: Artwork3D;
  reference: CuratedArtworkImage;
  scrollerRef: RefObject<HTMLDivElement | null>;
};

const paletteColors: Record<string, [string, string, string]> = {
  navy: ["#263867", "#c6aa72", "#111c38"],
  wine: ["#9d3548", "#dfbf8d", "#6f302c"],
  garden: ["#506c52", "#e5c587", "#5c4b31"],
  arches: ["#9b835c", "#efe1c2", "#79543c"],
  night: ["#222b42", "#b79155", "#4a5472"],
  sunrise: ["#bd6c49", "#f3d9a9", "#8c4936"],
  ocean: ["#2d6574", "#e2c99d", "#24434e"],
  morning: ["#8d7b57", "#eef0df", "#5e533f"],
};

let modulePreload: Promise<unknown> | null = null;

export function preloadArtworkExperience3D() {
  if (!modulePreload) {
    modulePreload = Promise.all([
      import("three"),
      import("three/addons/loaders/GLTFLoader.js"),
      import("gsap"),
      import("gsap/ScrollTrigger"),
      fetch(publicAsset("/models/product.glb")).catch(() => null),
    ]);
  }
  return modulePreload;
}

function makeArtworkCanvas(work: Artwork3D, back = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1365;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  const [, accent, dark] = paletteColors[work.palette] ?? paletteColors.navy;
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (back) {
    context.fillStyle = dark;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalAlpha = 0.5;
    context.strokeStyle = "#d8c8aa";
    context.lineWidth = 3;
    for (let y = 70; y < canvas.height; y += 34) {
      context.beginPath();
      context.moveTo(60, y);
      context.lineTo(canvas.width - 60, y + 18);
      context.stroke();
    }
    context.globalAlpha = 1;
    return canvas;
  }

  context.globalAlpha = 0.96;
  context.fillStyle = accent;
  context.beginPath();
  context.ellipse(290, 565, 330, 390, -0.08, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = dark;
  context.beginPath();
  context.ellipse(800, 1040, 330, 390, 0.16, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
  return canvas;
}

function alphaMixMaterial(THREE: typeof ThreeTypes, texture: ThreeTypes.Texture, baseColor: string) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texture,
    roughness: 0.74,
    metalness: 0.01,
    transparent: true,
    alphaTest: 0.02,
  });
  material.name = `catalog-artwork-${baseColor}`;
  return material;
}

export function ArtworkExperience3D({ work, reference, scrollerRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const controlsRef = useRef({ zoomIn: () => {}, zoomOut: () => {}, resetZoom: () => {} });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    async function mountExperience() {
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      const scroller = scrollerRef.current;
      if (!canvas || !stage || !scroller) return;

      try {
        void preloadArtworkExperience3D();
        const THREE = await import("three");
        const [{ GLTFLoader }, { gsap }, { ScrollTrigger }] = await Promise.all([
          import("three/addons/loaders/GLTFLoader.js"),
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
        camera.position.set(0, 0, 5.1);

        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        scene.add(new THREE.HemisphereLight(0xfff8eb, 0x18214b, 2.2));
        const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
        keyLight.position.set(3, 4, 5);
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0xd9bd7b, 2.1);
        rimLight.position.set(-4, 1, -3);
        scene.add(rimLight);

        const gltf = await new GLTFLoader().loadAsync(publicAsset("/models/product.glb"));
        if (cancelled) return;
        const product = gltf.scene;
        scene.add(product);

        const [base, , dark] = paletteColors[work.palette] ?? paletteColors.navy;
        let frontTexture: ThreeTypes.Texture;
        try {
          frontTexture = await new THREE.TextureLoader().loadAsync(reference.imageUrl);
        } catch {
          frontTexture = new THREE.CanvasTexture(makeArtworkCanvas(work));
        }
        const backTexture = new THREE.CanvasTexture(makeArtworkCanvas(work, true));
        frontTexture.colorSpace = THREE.SRGBColorSpace;
        backTexture.colorSpace = THREE.SRGBColorSpace;
        frontTexture.flipY = true;
        backTexture.flipY = false;
        frontTexture.needsUpdate = true;
        backTexture.needsUpdate = true;

        const frontMaterial = alphaMixMaterial(THREE, frontTexture, base);
        const backMaterial = alphaMixMaterial(THREE, backTexture, dark);
        const goldFrameMaterial = new THREE.MeshStandardMaterial({
          color: 0x9f7b3e,
          roughness: 0.38,
          metalness: 0.68,
        });

        product.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          if (object.name === "Front") object.material = frontMaterial;
          else if (object.name === "Back") object.material = backMaterial;
          else object.material = goldFrameMaterial;
        });

        const textureImage = frontTexture.image as { width?: number; height?: number } | undefined;
        const imageAspect = (textureImage?.width ?? 768) / Math.max(textureImage?.height ?? 1024, 1);
        const widthScale = THREE.MathUtils.clamp(imageAspect / 0.75, 0.55, 2.15);
        const progress = { value: 0 };
        let responsiveScale = 1;
        let manualYaw = 0;
        let manualPitch = 0;
        let autoYaw = 0;
        let zoom = 1;
        let pointerId: number | null = null;
        let animationFrame = 0;
        let lastFrame = performance.now();
        let lastInteraction = performance.now() - 4000;
        let startX = 0;
        let startY = 0;
        let startYaw = 0;
        let startPitch = 0;

        const applyProgress = () => {
          const p = progress.value;
          const spinPortion = 0.72;
          const entrance = THREE.MathUtils.clamp(p / 0.16, 0, 1);
          const spin = p <= spinPortion ? p / spinPortion : 1;
          const exit = p <= spinPortion ? 0 : (p - spinPortion) / (1 - spinPortion);
          const halfTurns = 0.12 + entrance * 0.38 + spin * 2.6;
          const punch = exit < 0.24
            ? THREE.MathUtils.lerp(1, 1.08, exit / 0.24)
            : THREE.MathUtils.lerp(1.08, 0.34, (exit - 0.24) / 0.76);

          product.rotation.y = halfTurns * Math.PI + manualYaw;
          product.rotation.x = THREE.MathUtils.lerp(-0.04, 0.04, entrance) - exit * 0.13 + manualPitch;
          product.position.y = THREE.MathUtils.lerp(0.08, 0, entrance) + exit * 1.85;
          const scale = THREE.MathUtils.lerp(0.88, 1, entrance) * punch * responsiveScale * zoom;
          product.scale.set(scale * widthScale, scale, scale);
          product.rotation.y += autoYaw;
          canvas.style.opacity = String(1 - THREE.MathUtils.smoothstep(exit, 0.7, 1));
          canvas.dataset.rotation = product.rotation.y.toFixed(3);
          canvas.dataset.zoom = zoom.toFixed(2);
        };

        const render = () => {
          applyProgress();
          renderer.render(scene, camera);
        };

        const markInteraction = () => { lastInteraction = performance.now(); };
        const setZoom = (nextZoom: number) => {
          zoom = THREE.MathUtils.clamp(nextZoom, 0.72, 1.65);
          markInteraction();
          render();
        };
        controlsRef.current = {
          zoomIn: () => setZoom(zoom + 0.14),
          zoomOut: () => setZoom(zoom - 0.14),
          resetZoom: () => setZoom(1),
        };

        const resize = () => {
          const width = stage.clientWidth;
          const height = Math.min(stage.clientHeight, window.innerHeight);
          renderer.setSize(width, height, false);
          camera.aspect = width / Math.max(height, 1);
          camera.updateProjectionMatrix();
          const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
          const availableWidth = visibleHeight * camera.aspect * 0.82;
          const availableHeight = visibleHeight * 0.74;
          const fitWidth = availableWidth / (1.68 * widthScale);
          const fitHeight = availableHeight / 2.18;
          responsiveScale = Math.min(1, fitWidth, fitHeight);
          render();
        };
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(stage);

        const beginDrag = (event: PointerEvent) => {
          if (!event.isPrimary) return;
          pointerId = event.pointerId;
          startX = event.clientX;
          startY = event.clientY;
          startYaw = manualYaw;
          startPitch = manualPitch;
          markInteraction();
          canvas.setPointerCapture(pointerId);
          stage.classList.add("is-dragging");
        };
        const drag = (event: PointerEvent) => {
          if (event.pointerId !== pointerId) return;
          const deltaX = event.clientX - startX;
          const deltaY = event.clientY - startY;
          if (Math.abs(deltaX) < Math.abs(deltaY) && event.pointerType === "touch") return;
          manualYaw = startYaw + deltaX * 0.012;
          manualPitch = THREE.MathUtils.clamp(startPitch + deltaY * 0.003, -0.22, 0.22);
          markInteraction();
          render();
        };
        const endDrag = (event: PointerEvent) => {
          if (event.pointerId !== pointerId) return;
          if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
          pointerId = null;
          stage.classList.remove("is-dragging");
        };
        const useKeyboard = (event: KeyboardEvent) => {
          const increments: Record<string, [number, number]> = {
            ArrowLeft: [-0.18, 0], ArrowRight: [0.18, 0], ArrowUp: [0, -0.06], ArrowDown: [0, 0.06],
          };
          const increment = increments[event.key];
          if (!increment) return;
          event.preventDefault();
          manualYaw += increment[0];
          manualPitch = THREE.MathUtils.clamp(manualPitch + increment[1], -0.22, 0.22);
          markInteraction();
          render();
        };
        const useWheelZoom = (event: WheelEvent) => {
          event.preventDefault();
          setZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1));
        };
        canvas.addEventListener("pointerdown", beginDrag);
        canvas.addEventListener("pointermove", drag);
        canvas.addEventListener("pointerup", endDrag);
        canvas.addEventListener("pointercancel", endDrag);
        canvas.addEventListener("keydown", useKeyboard);
        canvas.addEventListener("wheel", useWheelZoom, { passive: false });

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let trigger: ReturnType<typeof ScrollTrigger.create> | null = null;
        if (!reducedMotion) {
          trigger = ScrollTrigger.create({
            trigger: stage,
            scroller,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.35,
            onUpdate: (self) => {
              progress.value = self.progress;
              render();
            },
          });
          const animateIdle = (now: number) => {
            const elapsed = Math.min(now - lastFrame, 50);
            lastFrame = now;
            if (pointerId === null && now - lastInteraction > 2200) autoYaw += elapsed * 0.00011;
            render();
            animationFrame = requestAnimationFrame(animateIdle);
          };
          animationFrame = requestAnimationFrame(animateIdle);
        }

        resize();
        setReady(true);

        cleanup = () => {
          trigger?.kill();
          cancelAnimationFrame(animationFrame);
          resizeObserver.disconnect();
          canvas.removeEventListener("pointerdown", beginDrag);
          canvas.removeEventListener("pointermove", drag);
          canvas.removeEventListener("pointerup", endDrag);
          canvas.removeEventListener("pointercancel", endDrag);
          canvas.removeEventListener("keydown", useKeyboard);
          canvas.removeEventListener("wheel", useWheelZoom);
          controlsRef.current = { zoomIn: () => {}, zoomOut: () => {}, resetZoom: () => {} };
          frontTexture.dispose();
          backTexture.dispose();
          product.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => material.dispose());
          });
          renderer.dispose();
        };
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void mountExperience();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [reference.imageUrl, scrollerRef, work]);

  return (
    <section ref={stageRef} className={`artwork-3d-stage ${ready ? "is-ready" : ""}`} aria-label={`Visualização tridimensional de ${work.title}`}>
      <div className="artwork-3d-sticky">
        <img className="experience-preview" src={reference.imageUrl} alt="" aria-hidden="true" referrerPolicy="no-referrer" />
        <div className="experience-caption">
          <span>{work.code} · Vista interativa</span>
          <strong>{work.title}</strong>
          {work.dimensions && <small>{work.dimensions}</small>}
        </div>
        <div className="experience-edition-mark" aria-hidden="true"><span>Vernissage</span><strong>2026</strong></div>
        <canvas ref={canvasRef} role="img" tabIndex={0} aria-label={`Quadro 3D interativo de ${work.title}. Arraste para girar.`} />
        <div className="experience-zoom" aria-label="Controles de zoom">
          <span>Zoom</span>
          <button type="button" onClick={() => controlsRef.current.zoomOut()} aria-label="Reduzir quadro">−</button>
          <button type="button" onClick={() => controlsRef.current.resetZoom()} aria-label="Restaurar zoom">100%</button>
          <button type="button" onClick={() => controlsRef.current.zoomIn()} aria-label="Ampliar quadro">+</button>
        </div>
        <div className="experience-fallback" aria-hidden={ready}>{failed ? "Visualização estática disponível" : "Preparando visualização 3D…"}</div>
        <div className="experience-guide" aria-hidden="true">
          <small>Como explorar</small>
          <strong>Arraste para girar</strong>
          <span>Arraste para girar · use os controles para ampliar</span>
        </div>
      </div>
    </section>
  );
}
