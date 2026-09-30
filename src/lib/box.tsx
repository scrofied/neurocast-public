import React, { createContext, useContext } from "react";
import { useVideoConfig } from "remotion";

// Components size themselves from the box they are placed in, not from the video.
// Full-screen shots get 1920x1080; talking-head side panels get e.g. 340x780.
const BoxCtx = createContext<{ width: number; height: number } | null>(null);

export const Box: React.FC<{ width: number; height: number; children: React.ReactNode }> = ({ width, height, children }) => (
  <BoxCtx.Provider value={{ width, height }}>
    <div style={{ position: "absolute", left: 0, top: 0, width, height, overflow: "hidden" }}>{children}</div>
  </BoxCtx.Provider>
);

export const useBox = () => {
  const v = useVideoConfig();
  return useContext(BoxCtx) ?? { width: v.width, height: v.height };
};

// true when rendered inside a narrow side panel
export const useCompact = () => {
  const b = useBox();
  return b.width < 900;
};
