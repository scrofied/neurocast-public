import React, { createContext, useContext } from "react";

export type Skin = {
  name: string;
  bg: string;
  bg2: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  dim: string;
  glass: string;
  line: string;
};

export const SKINS: Record<string, Skin> = {
  aurora: { name: "aurora", bg: "#02050c", bg2: "#071a2b", primary: "#38f3ff", secondary: "#7c5cff", accent: "#ffb547", text: "#eaf6ff", dim: "#7f98b3", glass: "rgba(12,28,48,0.55)", line: "rgba(56,243,255,0.35)" },
  violet: { name: "violet", bg: "#05030d", bg2: "#1a0c33", primary: "#b18cff", secondary: "#22d3ee", accent: "#ff6ec7", text: "#f3edff", dim: "#9a8cbc", glass: "rgba(30,16,56,0.55)", line: "rgba(177,140,255,0.38)" },
  amber: { name: "amber", bg: "#070402", bg2: "#2a1606", primary: "#ffb547", secondary: "#ff5e3a", accent: "#5eead4", text: "#fff5e8", dim: "#b39a7f", glass: "rgba(44,26,10,0.55)", line: "rgba(255,181,71,0.36)" },
  matrix: { name: "matrix", bg: "#010805", bg2: "#032418", primary: "#3dffa8", secondary: "#22d3ee", accent: "#e5ff55", text: "#e9fff4", dim: "#7fb39a", glass: "rgba(6,36,24,0.55)", line: "rgba(61,255,168,0.34)" },
  arctic: { name: "arctic", bg: "#030611", bg2: "#0c1c3d", primary: "#8fd3ff", secondary: "#5b7cff", accent: "#ffd166", text: "#f2f7ff", dim: "#8ea3c4", glass: "rgba(16,30,60,0.55)", line: "rgba(143,211,255,0.36)" },
  oasis: { name: "oasis", bg: "#03040a", bg2: "#070b18", primary: "#36f1ff", secondary: "#ff2fd1", accent: "#ffc83d", text: "#eaf6ff", dim: "#8a93a6", glass: "rgba(6,10,24,0.55)", line: "rgba(54,241,255,0.35)" },
};

export const FONTS: Record<string, { title: string; body: string; mono: string }> = {
  yahei: { title: '"Microsoft YaHei UI","Microsoft YaHei","Noto Sans SC",sans-serif', body: '"Microsoft YaHei UI","Microsoft YaHei",sans-serif', mono: 'Consolas,"Cascadia Code",monospace' },
  noto: { title: '"Noto Sans SC","Microsoft YaHei",sans-serif', body: '"Noto Sans SC","Microsoft YaHei",sans-serif', mono: 'Consolas,"Cascadia Code",monospace' },
  deng: { title: '"DengXian","Microsoft YaHei",sans-serif', body: '"Microsoft YaHei UI","Microsoft YaHei",sans-serif', mono: 'Consolas,"Cascadia Code",monospace' },
};

export type Theme = Skin & { font: (typeof FONTS)[string]; bad: string; gold: string };

// shared semantic colours: negative/wrong/删除 and highlight/金子/TOP1 read the same in every skin
const SEMANTIC = { bad: "#ff5d6c", gold: "#ffcf5c" };

const Ctx = createContext<Theme>({ ...SKINS.aurora, font: FONTS.yahei, ...SEMANTIC });

export const ThemeProvider: React.FC<{ skin: string; font: string; children: React.ReactNode }> = ({ skin, font, children }) => (
  <Ctx.Provider value={{ ...(SKINS[skin] ?? SKINS.aurora), font: FONTS[font] ?? FONTS.yahei, ...SEMANTIC }}>{children}</Ctx.Provider>
);

export const useTheme = () => useContext(Ctx);

export const alpha = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
