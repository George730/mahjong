// Generates canvas-based textures for mahjong tile faces.
// Each unique tile face gets a dynamically rendered canvas texture cached by key.

import * as THREE from "three";
import type { TileFace } from "@mahjong/common";
import { tileFaceToString } from "@mahjong/common";

// --- Character and color maps ---

const SUIT_CHARS: Record<string, string> = { wan: "万", tiao: "条", tong: "筒" };
const SUIT_COLORS: Record<string, string> = {
  wan: "#dc2626",   // red
  tiao: "#15803d",  // green
  tong: "#2563eb",  // blue
};
const RANK_CHARS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const WIND_CHARS: Record<string, string> = { east: "東", south: "南", west: "西", north: "北" };
const DRAGON_MAP: Record<string, { char: string; color: string }> = {
  zhong: { char: "中", color: "#dc2626" },
  fa:    { char: "發", color: "#15803d" },
  bai:   { char: "白", color: "#2563eb" },
};
const SEASON_CHARS: Record<string, string> = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
const FLOWER_CHARS: Record<string, string> = { plum: "梅", orchid: "蘭", bamboo: "竹", chrysanthemum: "菊" };

// --- Texture cache ---

const textureCache = new Map<string, THREE.CanvasTexture>();

const TEXTURE_SIZE = 256; // px, power-of-2 for GPU
const FACE_BG = "#f5f0e1";     // ivory
const BACK_BG = "#1a3a5c";     // deep blue

function createCanvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, TEXTURE_SIZE, TEXTURE_SIZE);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

function drawTileFaceTexture(face: TileFace): THREE.CanvasTexture {
  return createCanvasTexture((ctx, w, h) => {
    // Background
    ctx.fillStyle = FACE_BG;
    ctx.fillRect(0, 0, w, h);

    // Subtle border
    ctx.strokeStyle = "#c8c0b0";
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    // Inner rounded area
    ctx.fillStyle = FACE_BG;
    ctx.fillRect(12, 12, w - 24, h - 24);

    // Text rendering
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    switch (face.category) {
      case "suited": {
        const color = SUIT_COLORS[face.suit];
        const rank = RANK_CHARS[face.rank - 1];
        const suit = SUIT_CHARS[face.suit];
        ctx.fillStyle = color;
        ctx.font = `bold ${w * 0.38}px "Noto Serif SC", serif`;
        ctx.fillText(rank, w / 2, h * 0.38);
        ctx.font = `bold ${w * 0.25}px "Noto Serif SC", serif`;
        ctx.fillText(suit, w / 2, h * 0.68);
        break;
      }
      case "wind": {
        const char = WIND_CHARS[face.wind];
        ctx.fillStyle = "#1a1a1a";
        ctx.font = `bold ${w * 0.5}px "Noto Serif SC", serif`;
        ctx.fillText(char, w / 2, h / 2);
        break;
      }
      case "dragon": {
        const d = DRAGON_MAP[face.dragon];
        ctx.fillStyle = d.color;
        ctx.font = `bold ${w * 0.55}px "Noto Serif SC", serif`;
        ctx.fillText(d.char, w / 2, h / 2);
        break;
      }
      case "season": {
        const char = SEASON_CHARS[face.season];
        ctx.fillStyle = "#d97706";
        ctx.font = `bold ${w * 0.45}px "Noto Serif SC", serif`;
        ctx.fillText(char, w / 2, h / 2);
        break;
      }
      case "flower": {
        const char = FLOWER_CHARS[face.flower];
        ctx.fillStyle = "#db2777";
        ctx.font = `bold ${w * 0.45}px "Noto Serif SC", serif`;
        ctx.fillText(char, w / 2, h / 2);
        break;
      }
    }
  });
}

/** Get (or create and cache) the face-up texture for a tile face. */
export function getTileFaceTexture(face: TileFace): THREE.CanvasTexture {
  const key = tileFaceToString(face);
  let tex = textureCache.get(key);
  if (!tex) {
    tex = drawTileFaceTexture(face);
    textureCache.set(key, tex);
  }
  return tex;
}

/** Shared back texture (deep blue with decorative border). */
let backTexture: THREE.CanvasTexture | null = null;

export function getTileBackTexture(): THREE.CanvasTexture {
  if (backTexture) return backTexture;
  backTexture = createCanvasTexture((ctx, w, h) => {
    // Deep blue background
    ctx.fillStyle = BACK_BG;
    ctx.fillRect(0, 0, w, h);

    // Decorative inner border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 3;
    const inset = w * 0.1;
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);

    // Center circle ornament
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.18, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner diamond
    const cx = w / 2, cy = h / 2, r = w * 0.1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fill();
  });
  return backTexture;
}

/** Shared side texture (ivory/cream edge). */
let sideTexture: THREE.CanvasTexture | null = null;

export function getTileSideTexture(): THREE.CanvasTexture {
  if (sideTexture) return sideTexture;
  sideTexture = createCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = "#e8e0d0";
    ctx.fillRect(0, 0, w, h);
    // Subtle vertical gradient for depth
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(255,255,255,0.15)");
    grad.addColorStop(0.5, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.08)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  return sideTexture;
}
