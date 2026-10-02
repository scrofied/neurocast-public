import React from "react";
import { lerp } from "./anim";
import { alpha, useTheme } from "./theme";

// ─────────────────────────────────────────────────────────────────────────────
// 无脸人物剪影（奥运图标式 pictogram）：关节角度驱动，可在姿势之间插值。
// 单位：h = 站立身高（px）。原点 = 双脚着地点。角度制：
//   lean  躯干前倾（0 竖直，+ 向面朝方向倾）
//   head  头部前点（+ 低头）
//   ls/rs 肩：上臂绝对角（0 = 垂直向下，+ 往身前抬，180 = 举过头顶）；le/re 肘：前臂相对上臂的弯曲
//   lh/rh 髋：大腿绝对角（0 = 向下，90 = 水平向前）；lk/rk 膝：小腿相对大腿（负 = 往后弯）
//   drop  髋部下沉（0~0.3，坐下约 0.22）；l* = 远侧肢体（画在后面、颜色更暗）
// ─────────────────────────────────────────────────────────────────────────────

export type Pose = { lean: number; head: number; ls: number; le: number; rs: number; re: number; lh: number; lk: number; rh: number; rk: number; drop: number };

const L = { thigh: 0.24, shin: 0.24, torso: 0.28, neck: 0.045, head: 0.074, upper: 0.16, fore: 0.15 };

export const POSES: Record<string, Pose> = {
  stand: { lean: 0, head: 0, ls: -4, le: 6, rs: 6, re: 8, lh: -3, lk: 0, rh: 3, rk: 0, drop: 0 },
  // 坐在桌前干活（手放在桌面上）
  work: { lean: 12, head: 14, ls: 55, le: 35, rs: 62, re: 30, lh: 88, lk: -88, rh: 92, rk: -92, drop: 0.22 },
  // 盯着屏幕：往前探、脑袋压低、手托着
  stare: { lean: 26, head: 18, ls: 40, le: 95, rs: 48, re: 90, lh: 88, lk: -84, rh: 92, rk: -90, drop: 0.22 },
  // 瘫在椅子上：往后仰、手垂下、腿伸直
  slump: { lean: -24, head: 34, ls: -14, le: 4, rs: -8, re: 6, lh: 70, lk: -30, rh: 76, rk: -24, drop: 0.25 },
  // 抱头崩溃
  despair: { lean: 22, head: 30, ls: 150, le: 130, rs: 150, re: 128, lh: 88, lk: -88, rh: 92, rk: -92, drop: 0.22 },
  // 双手叉腰 / 自信
  proud: { lean: -3, head: -6, ls: 30, le: -110, rs: 30, re: -110, lh: -6, lk: 0, rh: 6, rk: 0, drop: 0 },
  // 往下掉：手举过头、腿蜷
  fall: { lean: -10, head: -10, ls: 165, le: 10, rs: 150, re: -10, lh: 40, lk: -70, rh: 20, rk: -40, drop: 0 },
  // 挖：弯腰往下铲
  dig: { lean: 40, head: 10, ls: 70, le: 20, rs: 60, re: 30, lh: -12, lk: 8, rh: 20, rk: -18, drop: 0.03 },
  digUp: { lean: 12, head: -4, ls: 110, le: 40, rs: 100, re: 50, lh: -8, lk: 4, rh: 12, rk: -10, drop: 0 },
  // 照镜子：站直、手微抬
  look: { lean: 4, head: 4, ls: 20, le: 30, rs: 10, re: 20, lh: -3, lk: 0, rh: 3, rk: 0, drop: 0 },
  // 欢呼：双手举过头顶、抬头、微微跳起
  cheer: { lean: -6, head: -22, ls: 175, le: 22, rs: 172, re: -18, lh: 8, lk: -26, rh: -6, rk: -18, drop: 0.03 },
  // 举手示意 / 想插话
  raise: { lean: 2, head: -8, ls: 168, le: 8, rs: 22, re: 30, lh: -3, lk: 0, rh: 3, rk: 0, drop: 0 },
  // 双手举起（被拦、投降、震惊）
  handsUp: { lean: -4, head: -10, ls: 150, le: 30, rs: 148, re: 26, lh: -3, lk: 0, rh: 3, rk: 0, drop: 0 },
  // 瘫坐在地上（彻底没力气）
  sit: { lean: -14, head: 26, ls: 40, le: 10, rs: 34, re: 14, lh: 46, lk: -96, rh: 54, rk: -102, drop: 0.3 },
  // 伸手去够（拿东西 / 抓住机会）
  reach: { lean: 10, head: -6, ls: 96, le: -14, rs: 30, re: 20, lh: -3, lk: 0, rh: 6, rk: 0, drop: 0 },
  // 回头 / 转头张望
  turn: { lean: 0, head: -14, ls: 12, le: 24, rs: -6, re: 30, lh: -3, lk: 0, rh: 3, rk: 0, drop: 0 },
};

export const mixPose = (a: Pose, b: Pose, k: number): Pose => {
  const o = {} as Pose;
  (Object.keys(a) as (keyof Pose)[]).forEach((key) => (o[key] = lerp(a[key], b[key], k)));
  return o;
};

// 走 / 跑的步态循环（phase 以圈计，1 = 迈两步）
export const gait = (phase: number, run = 0): Pose => {
  const s = Math.sin(phase * Math.PI * 2);
  const c = Math.cos(phase * Math.PI * 2);
  const leg = lerp(24, 42, run);
  const arm = lerp(22, 55, run);
  return {
    lean: lerp(3, 16, run),
    head: lerp(0, -4, run),
    ls: -s * arm,
    le: lerp(12, 85, run),
    rs: s * arm,
    re: lerp(12, 85, run),
    lh: s * leg,
    lk: -Math.max(0, -c) * lerp(30, 80, run) - 4,
    rh: -s * leg,
    rk: -Math.max(0, c) * lerp(30, 80, run) - 4,
    drop: lerp(0.01, 0.04, run) + Math.abs(c) * 0.012,
  };
};

const rad = (d: number) => (d * Math.PI) / 180;
// limb direction: angle 0 = straight down, + = toward facing direction (+x)
const dir = (a: number) => ({ x: Math.sin(rad(a)), y: Math.cos(rad(a)) });

export type Joints = Record<"hip" | "shoulder" | "neck" | "head" | "lElbow" | "lHand" | "rElbow" | "rHand" | "lKnee" | "lFoot" | "rKnee" | "rFoot", { x: number; y: number }>;

// joint positions in px relative to the feet origin, facing +x
export const figJoints = (p: Pose, h: number): Joints => {
  const hip = { x: 0, y: -(L.thigh + L.shin - p.drop) * h };
  const td = { x: Math.sin(rad(p.lean)), y: -Math.cos(rad(p.lean)) };
  const shoulder = { x: hip.x + td.x * L.torso * h, y: hip.y + td.y * L.torso * h };
  const neck = { x: shoulder.x + td.x * L.neck * h, y: shoulder.y + td.y * L.neck * h };
  const ha = rad(p.lean + p.head);
  const head = { x: neck.x + Math.sin(ha) * L.head * h, y: neck.y - Math.cos(ha) * L.head * h };
  const limb = (o: { x: number; y: number }, a: number, b: number, l1: number, l2: number) => {
    const d1 = dir(a);
    const m = { x: o.x + d1.x * l1 * h, y: o.y + d1.y * l1 * h };
    const d2 = dir(a + b);
    return [m, { x: m.x + d2.x * l2 * h, y: m.y + d2.y * l2 * h }];
  };
  const [lElbow, lHand] = limb(shoulder, p.ls, p.le, L.upper, L.fore);
  const [rElbow, rHand] = limb(shoulder, p.rs, p.re, L.upper, L.fore);
  const [lKnee, lFoot] = limb(hip, p.lh, p.lk, L.thigh, L.shin);
  const [rKnee, rFoot] = limb(hip, p.rh, p.rk, L.thigh, L.shin);
  return { hip, shoulder, neck, head, lElbow, lHand, rElbow, rHand, lKnee, lFoot, rKnee, rFoot };
};

// convert a local joint (facing +x) to parent coords given placement
export const toWorld = (j: { x: number; y: number }, x: number, y: number, face: 1 | -1 = 1) => ({ x: x + j.x * face, y: y + j.y });

/**
 * SVG <g> 人物。放在 <svg> 里用。x/y = 双脚着地点，h = 身高。
 * color 缺省 = 主题 text；glow 给一圈外发光；dim 0~1 让人物变暗（受难/失败）。
 */
export const Figure: React.FC<{ x: number; y: number; h: number; pose: Pose; face?: 1 | -1; color?: string; glow?: string; dim?: number; opacity?: number; rot?: number }> = ({
  x,
  y,
  h,
  pose,
  face = 1,
  color,
  glow,
  dim = 0,
  opacity = 1,
  rot = 0,
}) => {
  const t = useTheme();
  const c = color ?? t.text;
  const j = figJoints(pose, h);
  const w = 0.078 * h;
  const seg = (pts: { x: number; y: number }[]) => `M${pts.map((p) => `${p.x},${p.y}`).join(" L")}`;
  const back = alpha(c, 0.55);
  const shade = dim > 0 ? `brightness(${1 - dim * 0.55}) saturate(${1 - dim * 0.7})` : "";
  const glowF = glow ? `drop-shadow(0 0 ${h * 0.05}px ${alpha(glow, 0.75)})` : "";
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${face} 1)`} opacity={opacity} style={{ filter: [glowF, shade].filter(Boolean).join(" ") || undefined }}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={seg([j.shoulder, j.lElbow, j.lHand])} stroke={back} strokeWidth={w * 0.92} />
        <path d={seg([j.hip, j.lKnee, j.lFoot])} stroke={back} strokeWidth={w * 1.05} />
        <path d={seg([j.hip, j.shoulder])} stroke={c} strokeWidth={w * 1.9} />
        <path d={seg([j.hip, j.rKnee, j.rFoot])} stroke={c} strokeWidth={w * 1.05} />
        <path d={seg([j.shoulder, j.rElbow, j.rHand])} stroke={c} strokeWidth={w * 0.92} />
      </g>
      <circle cx={j.head.x} cy={j.head.y} r={L.head * h * 0.95} fill={c} />
    </g>
  );
};
