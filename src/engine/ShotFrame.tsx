import React from "react";
import { AbsoluteFill } from "remotion";
import { clamp, easeIn, easeOutQuint, noise1, prog } from "../lib/anim";
import { alpha, useTheme } from "../lib/theme";

const ENTER = 18;
const EXIT = 12;
// every shot is rendered this many frames past its end so its exit crosses the next shot's entry
export const OVERLAP = 12;
export const TRANSITIONS = ["fly", "warp", "iris", "glitch", "fade", "cut"] as const;

// Wraps every shot: entry/exit transition + continuous slow camera move so no frame is static.
// "cut": no entry animation (e.g. the talking-head opening must be visible from frame 0), soft exit.
export const ShotFrame: React.FC<{ frame: number; dur: number; transition: string; seed: number; children: React.ReactNode }> = ({
  frame,
  dur,
  transition,
  seed,
  children,
}) => {
  const t = useTheme();
  const pin = transition === "cut" ? 1 : easeOutQuint(prog(frame, 0, ENTER));
  const pout = easeIn(prog(frame, dur - EXIT, EXIT));
  const life = clamp(frame / Math.max(1, dur));
  const push = 1 + life * 0.045;
  const dx = noise1(frame / 80, seed) * 10;
  const dy = noise1(frame / 95, seed + 7) * 6;
  const rz = noise1(frame / 120, seed + 3) * 0.4;

  let style: React.CSSProperties = {};
  let overlay: React.ReactNode = null;
  if (transition === "cut" || transition === "fade") {
    style = { opacity: pin * (1 - pout), transform: `scale(${1 + pout * 0.06})`, filter: pout > 0.01 ? `blur(${pout * 10}px)` : undefined };
  } else if (transition === "fly") {
    const s = 0.55 + 0.45 * pin + pout * 0.9;
    style = { transform: `scale(${s})`, opacity: pin * (1 - pout), filter: `blur(${(1 - pin) * 14 + pout * 18}px)` };
  } else if (transition === "warp") {
    style = {
      transform: `perspective(1600px) rotateY(${(1 - pin) * -38 + pout * 32}deg) translateX(${(1 - pin) * 260 - pout * 300}px) scale(${0.9 + 0.1 * pin})`,
      opacity: pin * (1 - pout),
      filter: `blur(${(1 - pin) * 8 + pout * 10}px)`,
    };
  } else if (transition === "iris") {
    const r = pin * 120 * (1 - pout * 0.999);
    style = { clipPath: `circle(${r}% at 50% 48%)`, transform: `scale(${1.15 - 0.15 * pin})` };
    overlay = (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "48%",
          width: 0,
          height: 0,
          boxShadow: `0 0 0 ${r * 11}px transparent, 0 0 60px 6px ${alpha(t.primary, (1 - pin) * 0.8 + pout * 0.8)}`,
          borderRadius: "50%",
        }}
      />
    );
  } else {
    // glitch
    const g = (1 - pin) + pout;
    const j = g > 0.02 ? noise1(frame * 3.1, seed) * 40 * g : 0;
    style = { transform: `translateX(${j}px) skewX(${j * 0.08}deg)`, opacity: clamp(pin * 1.4) * (1 - pout), filter: g > 0.02 ? `hue-rotate(${j * 3}deg) contrast(${1 + g * 0.6})` : undefined };
    if (g > 0.05)
      overlay = (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${((noise1(frame * 1.7 + i * 11, seed) + 1) / 2) * 100}%`,
                height: 4 + i * 5,
                background: alpha(i % 2 ? t.primary : t.secondary, 0.55 * g),
                transform: `translateX(${noise1(frame * 2 + i, seed) * 120}px)`,
                mixBlendMode: "screen",
              }}
            />
          ))}
        </>
      );
  }

  return (
    <AbsoluteFill>
      <AbsoluteFill style={style}>
        <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) scale(${push}) rotate(${rz}deg)` }}>{children}</AbsoluteFill>
      </AbsoluteFill>
      {overlay}
    </AbsoluteFill>
  );
};
