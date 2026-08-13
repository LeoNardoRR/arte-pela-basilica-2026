"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import type * as ThreeTypes from "three";

type Artwork3D = {
  code: string;
  title: string;
  palette: string;
};

type Props = {
  work: Artwork3D;
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

function makeArtworkCanvas(work: Artwork3D, back = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1365;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  const [, accent, dark] = paletteColors[work.palette] ?? paletteColors.navy;
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (back) {
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
    color: baseColor,
    map: texture,
    roughness: 0.78,
    metalness: 0.02,
    transparent: false,
    alphaTest: 0,
  });

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D(map, vMapUv);
        diffuseColor.rgb = mix(diffuseColor.rgb, sampledDiffuseColor.rgb, sampledDiffuseColor.a);
      #endif`,
    );
  };
  material.customProgramCacheKey = () => "artwork-alpha-mix-v1";
  return material;
}

export function ArtworkExperience3D({ work, scrollerRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLElement>(null);
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

        const gltf = await new GLTFLoader().loadAsync("/models/product.glb");
        if (cancelled) return;
        const product = gltf.scene;
        scene.add(product);

        const [base, , dark] = paletteColors[work.palette] ?? paletteColors.navy;
        const frontTexture = new THREE.CanvasTexture(makeArtworkCanvas(work));
        const backTexture = new THREE.CanvasTexture(makeArtworkCanvas(work, true));
        frontTexture.colorSpace = THREE.SRGBColorSpace;
        backTexture.colorSpace = THREE.SRGBColorSpace;
        frontTexture.flipY = false;
        backTexture.flipY = false;

        const frontMaterial = alphaMixMaterial(THREE, frontTexture, base);
        const backMaterial = alphaMixMaterial(THREE, backTexture, dark);
        product.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          if (object.name === "Front") object.material = frontMaterial;
          if (object.name === "Back") object.material = backMaterial;
        });

        const progress = { value: 0 };
        let animationFrame = 0;
        let playing = false;
        let responsiveScale = 1;

        const applyProgress = () => {
          const p = progress.value;
          const spinPortion = 0.72;
          const entrance = THREE.MathUtils.clamp(p / 0.18, 0, 1);
          const spin = p <= spinPortion ? p / spinPortion : 1;
          const exit = p <= spinPortion ? 0 : (p - spinPortion) / (1 - spinPortion);
          const halfTurns = entrance + spin * 3;
          const punch = exit < 0.24 ? THREE.MathUtils.lerp(1, 1.08, exit / 0.24) : THREE.MathUtils.lerp(1.08, 0.34, (exit - 0.24) / 0.76);

          product.rotation.y = halfTurns * Math.PI;
          product.rotation.x = THREE.MathUtils.lerp(-0.08, 0.04, entrance) - exit * 0.13;
          product.position.y = THREE.MathUtils.lerp(-1.45, 0, entrance) + exit * 1.85;
          const scale = THREE.MathUtils.lerp(0.58, 1, entrance) * punch * responsiveScale;
          product.scale.setScalar(scale);
          canvas.style.opacity = String(1 - THREE.MathUtils.smoothstep(exit, 0.7, 1));
        };

        const render = () => {
          applyProgress();
          renderer.render(scene, camera);
        };
        const loop = () => {
          if (!playing) return;
          render();
          animationFrame = requestAnimationFrame(loop);
        };
        const startLoop = () => {
          if (playing) return;
          playing = true;
          loop();
        };
        const stopLoop = () => {
          playing = false;
          cancelAnimationFrame(animationFrame);
          render();
        };

        const resize = () => {
          const width = stage.clientWidth;
          const height = Math.min(stage.clientHeight, window.innerHeight);
          responsiveScale = width < 620 ? 0.74 : width < 950 ? 0.88 : 1;
          renderer.setSize(width, height, false);
          camera.aspect = width / Math.max(height, 1);
          camera.updateProjectionMatrix();
          render();
        };
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(stage);

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let trigger: ReturnType<typeof ScrollTrigger.create> | null = null;
        if (reducedMotion) {
          progress.value = 0.22;
          product.rotation.y = Math.PI * 0.16;
          render();
        } else {
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
            onEnter: startLoop,
            onEnterBack: startLoop,
            onLeave: stopLoop,
            onLeaveBack: stopLoop,
          });
        }

        resize();
        setReady(true);

        cleanup = () => {
          trigger?.kill();
          stopLoop();
          resizeObserver.disconnect();
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
  }, [scrollerRef, work]);

  return (
    <section ref={stageRef} className={`artwork-3d-stage ${ready ? "is-ready" : ""}`} aria-label={`Visualização tridimensional de ${work.title}`}>
      <div className="artwork-3d-sticky">
        <div className="experience-caption"><span>Experiência individual</span><strong>Role para observar frente, espessura e verso</strong></div>
        <canvas ref={canvasRef} role="img" aria-label={`Prévia tridimensional de ${work.title}`} />
        <div className="experience-fallback" aria-hidden={ready}>{failed ? "Visualização estática disponível" : "Preparando visualização 3D…"}</div>
        <div className="experience-progress" aria-hidden="true"><span>Entrada</span><span>Giro</span><span>Detalhes</span></div>
      </div>
    </section>
  );
}
