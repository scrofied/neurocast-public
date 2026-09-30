import React from "react";
import { easeOut, prog } from "../../lib/anim";
import { Icon } from "../../lib/icons";
import { alpha, useTheme } from "../../lib/theme";

// Generic "little web tool" mock shared by the code→product components (file-launch / bug-fix-loop / drag-deploy).
// Laid out on an 800-wide design grid and scaled to `w`; `btn` = where the main button sits (for cursors).
export const MINI = { bar: 46, pad: 26, title: 44, inputs: 50, gap: 18, btnW: 220, btnH: 56 };
export const miniButton = (w: number, chrome = true) => {
  const s = w / 800;
  const y = (chrome ? MINI.bar : 0) + MINI.pad + MINI.title + MINI.gap + MINI.inputs + MINI.gap;
  return { x: (MINI.pad + MINI.btnW / 2) * s, y: (y + MINI.btnH / 2) * s };
};

export type MiniAppSpec = { title: string; url?: string; button?: string; inputs?: string[] };

export const MiniApp: React.FC<{
  w: number;
  h: number;
  frame: number;
  app: MiniAppSpec;
  workAt?: number; // result rows fill in, one row flagged
  fail?: number; // frame the button was clicked without effect (shake + red)
  chrome?: boolean;
}> = ({ w, h, frame, app, workAt, fail, chrome = true }) => {
  const t = useTheme();
  const s = w / 800;
  const working = workAt !== undefined && frame >= workAt;
  const shk = fail !== undefined && frame >= fail && frame < fail + 12 ? Math.sin((frame - fail) * 2.4) * 10 * s * (1 - (frame - fail) / 12) : 0;
  const failed = fail !== undefined && frame >= fail && !working;
  const rows = 5;
  return (
    <div style={{ position: "relative", width: w, height: h, borderRadius: 14 * s, overflow: "hidden", background: "#0b1220", border: `${Math.max(1.5, 2 * s)}px solid ${alpha(t.primary, 0.55)}`, boxShadow: `0 0 ${40 * s}px ${alpha(t.primary, 0.25)}, 0 ${20 * s}px ${50 * s}px rgba(0,0,0,.55)` }}>
      {chrome && (
        <div style={{ height: MINI.bar * s, display: "flex", alignItems: "center", gap: 8 * s, padding: `0 ${14 * s}px`, background: "#141d30", borderBottom: `1px solid ${alpha(t.primary, 0.2)}` }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 13 * s, height: 13 * s, borderRadius: 7 * s, background: c }} />
          ))}
          <div style={{ marginLeft: 14 * s, flex: 1, height: 28 * s, borderRadius: 14 * s, background: "#0b1220", display: "flex", alignItems: "center", gap: 8 * s, padding: `0 ${12 * s}px`, fontFamily: t.font.mono, fontSize: 17 * s, color: t.dim, whiteSpace: "nowrap", overflow: "hidden" }}>
            <Icon name="lock" size={15 * s} color={t.primary} />
            {app.url ?? "index.html"}
          </div>
        </div>
      )}
      <div style={{ padding: MINI.pad * s }}>
        <div style={{ height: MINI.title * s, display: "flex", alignItems: "center", gap: 12 * s, fontFamily: t.font.title, fontWeight: 900, fontSize: 30 * s, color: t.text, whiteSpace: "nowrap" }}>
          <Icon name="grid" size={32 * s} color={t.primary} />
          {app.title}
        </div>
        <div style={{ height: MINI.inputs * s, marginTop: MINI.gap * s, display: "flex", gap: 14 * s }}>
          {(app.inputs ?? ["数据 A", "数据 B"]).slice(0, 3).map((x, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 * s, padding: `0 ${16 * s}px`, borderRadius: 10 * s, border: `${1.5 * s}px dashed ${alpha(t.primary, 0.5)}`, background: alpha(t.primary, 0.06), fontFamily: t.font.body, fontSize: 19 * s, color: t.text, whiteSpace: "nowrap" }}>
              <Icon name="doc" size={20 * s} color={t.primary} />
              {x}
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: MINI.gap * s,
            width: MINI.btnW * s,
            height: MINI.btnH * s,
            borderRadius: 12 * s,
            transform: `translateX(${shk}px)`,
            background: failed ? alpha(t.bad, 0.25) : working ? `linear-gradient(135deg, ${t.primary}, ${t.secondary})` : alpha(t.primary, 0.85),
            border: failed ? `${2 * s}px solid ${t.bad}` : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8 * s,
            fontFamily: t.font.title,
            fontWeight: 900,
            fontSize: 24 * s,
            color: failed ? t.bad : t.bg,
          }}
        >
          {failed && <Icon name="x" size={24 * s} color={t.bad} stroke={3} />}
          {working && <Icon name="check" size={24 * s} color={t.bg} stroke={3} />}
          {app.button ?? "开始"}
        </div>
        <div style={{ marginTop: 22 * s, display: "flex", flexDirection: "column", gap: 10 * s }}>
          {Array.from({ length: rows }, (_, i) => {
            const p = working ? easeOut(prog(frame, workAt! + i * 3, 10)) : 0;
            const flag = i === 2 && p > 0.5;
            return (
              <div key={i} style={{ height: 38 * s, borderRadius: 8 * s, display: "flex", alignItems: "center", gap: 12 * s, padding: `0 ${12 * s}px`, background: flag ? alpha(t.bad, 0.22) : alpha(t.text, 0.04), border: `${1 * s}px solid ${flag ? t.bad : alpha(t.text, 0.08)}` }}>
                {[0.28, 0.2, 0.16].map((wf, k) => (
                  <span key={k} style={{ height: 12 * s, width: `${wf * 100 * (0.3 + 0.7 * p)}%`, borderRadius: 6 * s, background: flag && k === 2 ? t.bad : alpha(t.text, 0.12 + 0.2 * p) }} />
                ))}
                {flag && <span style={{ marginLeft: "auto", fontFamily: t.font.body, fontWeight: 800, fontSize: 18 * s, color: t.bad }}>≠</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
