import { mkdir, writeFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    result = null;
    onloadend = null;
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      });
    }
  };
}

const scene = new THREE.Scene();
const product = new THREE.Group();
product.name = "ArtworkProduct";

const surface = new THREE.PlaneGeometry(1.5, 2, 1, 1);
const placeholder = new THREE.MeshStandardMaterial({ color: 0xffffff });

const front = new THREE.Mesh(surface, placeholder);
front.name = "Front";
front.position.z = 0.091;
product.add(front);

const back = new THREE.Mesh(surface.clone(), placeholder.clone());
back.name = "Back";
back.position.z = -0.091;
back.rotation.y = Math.PI;
product.add(back);

const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xd8c8aa, roughness: 0.55, metalness: 0.06 });
const vertical = new THREE.BoxGeometry(0.09, 2.18, 0.18);
const horizontal = new THREE.BoxGeometry(1.68, 0.09, 0.18);

for (const x of [-0.795, 0.795]) {
  const rail = new THREE.Mesh(vertical, frameMaterial);
  rail.name = x < 0 ? "FrameLeft" : "FrameRight";
  rail.position.x = x;
  product.add(rail);
}

for (const y of [-1.045, 1.045]) {
  const rail = new THREE.Mesh(horizontal, frameMaterial);
  rail.name = y < 0 ? "FrameBottom" : "FrameTop";
  rail.position.y = y;
  product.add(rail);
}

scene.add(product);

const exporter = new GLTFExporter();
const binary = await new Promise((resolve, reject) => {
  exporter.parse(scene, resolve, reject, { binary: true, onlyVisible: true });
});

await mkdir(new URL("../public/models/", import.meta.url), { recursive: true });
await writeFile(new URL("../public/models/product.glb", import.meta.url), new Uint8Array(binary));
