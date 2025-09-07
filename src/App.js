import React, { useEffect, useRef, useMemo, useState } from "react";
import clsx from "clsx";
import { generateSchedule } from './scheduler.js';
import "./App.css";

import { TimelineCards } from "./TimelineCards.jsx";

function formatTime(val) {
  if (val < 60) return `${Number(Math.round(val + 'e' + 2) + 'e-' + 2)}s`;
  if (val < 3600) return `${Number(Math.round((val / 60) + 'e' + 2) + 'e-' + 2)}m`;
  return `${Number(Math.round((val / 3600) + 'e' + 2) + 'e-' + 2)}h`;
}

/** ---------- GanttChart component (SVG) ---------- */
function GanttChart({
  tasks,
  groupBy = "worker",
  pxPerSec = 0.03,
  colorForId,
  rowHeight = 34,
  rowGap = 6,
  axisHeight = 28,
}) {
  const meta = useMemo(() => {
    if (!tasks?.length) {
      return {
        minStart: 0,
        maxEnd: 0,
        groups: [],
        height: axisHeight + 20,
        width: 400,
      };
    }
    const minStart = Math.min(...tasks.map((t) => t.start));
    const maxEnd = Math.max(...tasks.map((t) => t.end));
    const groups = [...new Set(tasks.map((t) => String(t[groupBy])))]
      .sort((a, b) => Number(a) - Number(b));
    const rows = groups.length;
    const height = axisHeight + rows * (rowHeight + rowGap) + 20;
    const width = Math.max(600, (maxEnd - minStart) * pxPerSec + 160);
    return { minStart, maxEnd, groups, height, width };
  }, [tasks, groupBy, pxPerSec, rowHeight, rowGap, axisHeight]);

  const { minStart, maxEnd, groups, height, width } = meta;
  const uniqueIds = React.useMemo(
    () => [...new Set(tasks.map(t => String(t.id)))],
    [tasks]
  );
  const hoursTotal = (maxEnd - minStart) / 3600;
  const tickEveryHours = hoursTotal > 24 ? 4 : hoursTotal > 8 ? 2 : 1;

  // const colorMap = React.useMemo(() => {
  //   const palette = [
  //     "#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF",
  //     "#E3BAFF", "#FFD6E0", "#C7FFD8", "#FFF5BA", "#BAFFD6",
  //     "#FFD1BA", "#D6FFBA", "#FFBABA", "#BAE7FF", "#E0BAFF",
  //     "#FFE0BA", "#BAFFD4", "#FFBAF2", "#E0FFBA", "#BAC2FF",
  //     "#FFC2BA", "#C2FFBA", "#BAFFC2", "#C2BAFF", "#FFBAC2",
  //     "#BAFFF2", "#FFDABA", "#F2FFBA", "#BACFFF", "#FFBAE1"
  //   ];
  //   const map = {};
  //   uniqueIds.forEach((id, i) => { map[id] = palette[i % palette.length]; });
  //   return map;
  // }, [uniqueIds]);

  return (
    <div>
      <div style={{
        overflow: "auto",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        background: "#fff",
        boxShadow: "0 2px 12px #e0e7ff"
      }}>
        <svg width={width} height={height} style={{ display: "block" }}>
          <rect x="0" y="0" width={width} height={height} fill="#fff" />
          <rect x="120" y="0" width={width - 120} height={axisHeight} fill="#f8fafc" />
          <rect x="0" y="0" width="120" height={height} fill="#f9fafb" />

          {/* Axis */}
          {Array.from({ length: Math.floor(hoursTotal / tickEveryHours) + 1 }).map((_, i) => {
            const hour = i * tickEveryHours;
            const sec = minStart + hour * 3600;
            const x = 120 + (sec - minStart) * pxPerSec;
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={0} y2={height} stroke="#e5e7eb" />
                <text x={x + 4} y={18} fontSize="12" fontWeight={500} fill="#475569">{`${hour}h`}</text>
              </g>
            );
          })}

          {/* Rows */}
          {groups.map((g, idx) => {
            const y = axisHeight + idx * (rowHeight + rowGap);
            const label = groupBy === "worker"
              ? `Builder ${Number(g) + 1}`
              : `${groupBy}: ${g}`;
            return (
              <g key={g}>
                <text x={18} y={y + rowHeight * 0.65} fontSize="14" fontWeight={600} fill="#111827">
                  {label}
                </text>
                <line
                  x1={120}
                  x2={width}
                  y1={y + rowHeight + rowGap / 2}
                  y2={y + rowHeight + rowGap / 2}
                  stroke="#f1f5f9"
                />
              </g>
            );
          })}

          {/* Bars with tooltip */}
          {tasks.map((t, i) => {
            const fill = colorForId(t.id)
            const row = groups.indexOf(String(t[groupBy]));
            const y = axisHeight + row * (rowHeight + rowGap) + 4;
            const x = 120 + (t.start - minStart) * pxPerSec;
            const w = Math.max(2, (t.end - t.start) * pxPerSec);
            const hrs = formatTime(t.duration); //Math.round(((t.end - t.start) / 3600) * 10) / 10
            const label = `${t.id} L${t.level} ${t.iter} (${hrs})`;
            return (
              <g key={i}>
                <rect x={x} y={y} width={w} height={rowHeight - 8} rx="6" ry="6" fill={fill} opacity="0.92" style={{ cursor: "pointer" }} />
                <rect x={x} y={y} width={w} height={rowHeight - 8} rx="6" ry="6" fill="none" stroke="rgba(0,0,0,0.15)" />
                <clipPath id={`clip-${i}`}>
                  <rect x={x + 6} y={y} width={Math.max(0, w - 12)} height={rowHeight - 8} />
                </clipPath>
                <text x={x + 10} y={y + (rowHeight - 8) * 0.62} fontSize="13" fontWeight={500} fill="#0f172a" clipPath={`url(#clip-${i})`}>
                  {label}
                </text>
                <title>{`${t.id} L${t.level}\n• Builder ${t.worker + 1}\n• Group: ${t.iter}\n• Start ${formatTime(t.start)} • End ${formatTime(t.end)}\n• Duration ${formatTime(t.duration)}`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      <Legend
        items={uniqueIds.map(id => ({
          label: id,
          color: colorForId(id)
        }))}
      />
    </div>
  );
}

function Legend({ items }) {
  if (!items?.length) return null;
  return (
    <div
      style={{
        marginTop: 10,
        padding: "8px 10px",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>Legend</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {items.map(({ label, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              aria-hidden
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: color,
                border: "1px solid rgba(0,0,0,0.2)",
              }}
              title={label}
            />
            <span style={{ fontSize: 12, color: "#0f172a" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * JsonInput (resizable both axes + size persistence)
 * Props:
 *  - label?: string
 *  - initial?: object | string
 *  - onValid?: (obj:any)=>void
 *  - storageKey?: string   // optional key to persist size
 */
export function JsonInput({ label = "JSON Input", initial = "", onValid, onValidityChange, storageKey = "JSON" }) {
  // const [text, setText] = React.useState(initial);
  const [text, setText] = React.useState(
    typeof initial === "string"
      ? initial
      : initial
        ? JSON.stringify(initial, null, 2)
        : ""
  );
  const [error, setError] = React.useState("");


  // --- load saved width/height (optional) ---
  const [boxSize, setBoxSize] = React.useState(() => {
    try {
      const saved = storageKey && JSON.parse(localStorage.getItem(storageKey) || "{}");
      return {
        width: saved.width || 560,   // starting size
        height: saved.height || 200,
      };
    } catch {
      return { width: 560, height: 200 };
    }
  });

  const areaRef = React.useRef(null);

  // Check validity on every change
  const isValid = React.useMemo(() => {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }, [text]);

  // Notify parent about validity
  React.useEffect(() => {
    onValidityChange?.(isValid);

    if (isValid) {
      try {
        const obj = JSON.parse(text);
        onValid?.(obj);   // 🔥 automatically push parsed JSON up
      } catch {
        /* should not happen since isValid is true */
      }
    }
  }, [isValid, text, onValid, onValidityChange]);

  // Persist size after user resizes (mouseup is enough for native resize handles)
  const saveSize = () => {
    const el = areaRef.current;
    if (!el || !storageKey) return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    setBoxSize({ width, height });
    try {
      localStorage.setItem(storageKey, JSON.stringify({ width, height }));
    } catch { }
  };

  const handleFormat = () => {
    try {
      const obj = JSON.parse(text);
      setText(JSON.stringify(obj, null, 2));
      setError("");
    } catch (e) {
      setError("Cannot format: " + e.message);
    }
  };

  const handleClear = () => {
    setText("");
    setError("");
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={{ fontSize: 13, color: "#64748b" }}>{label}</label>

      <textarea
        ref={areaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onMouseUp={saveSize}                 // save new size after drag
        placeholder='{"foo": 1, "bar": [2,3]}'
        spellCheck={false}
        style={{
          display: "block",                   // stays in normal flow so others reflow
          width: boxSize.width,               // initial/persisted size
          height: boxSize.height,
          minWidth: "30vw",
          minHeight: "10vh",
          maxWidth: "70vw",    // 👈 cap width
          maxHeight: "30vh",
          boxSizing: "border-box",
          resize: "both",                     // 👈 enables horizontal + vertical resize
          overflow: "auto",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 13,
          padding: 12,
          borderRadius: 10,
          border: `1px solid ${isValid ? "#cbd5e1" : "#fca5a5"}`,
          outline: "none",
          background: "#fff",
          color: "#0f172a",
          boxShadow: isValid ? "none" : "0 0 0 3px rgba(239,68,68,0.12)",
        }}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={handleFormat} style={btnSecondary}>Format</button>
        <button onClick={handleClear} style={btnGhost}>Clear</button>

        <span style={{ marginLeft: "auto", fontSize: 12, color: isValid ? "#16a34a" : "#ef4444", fontWeight: 600 }}>
          {isValid ? "Valid JSON" : "Invalid JSON"}
        </span>
      </div>

      {error && <div style={{ fontSize: 12, color: "#b91c1c" }}>{error}</div>}
    </div>
  );
}

const btnBase = { padding: "8px 12px", borderRadius: 10, fontWeight: 600, cursor: "pointer", border: "1px solid" };
const btnSecondary = { ...btnBase, background: "#fff", color: "#0f172a", borderColor: "#cbd5e1" };
const btnGhost = { ...btnBase, background: "transparent", color: "#0f172a", borderColor: "#e5e7eb" };

// 20-color palette (good contrast with black text)
const PALETTE = [
  "#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF",
  "#E3BAFF", "#FFD6E0", "#C7FFD8", "#FFF5BA", "#BAFFD6",
  "#D6FFBA", "#FFBABA", "#BAE7FF", "#E0BAFF", "#FFE0BA",
  "#BAFFD4", "#FFBAF2", "#E0FFBA", "#BAC2FF", "#FFC2BA"
];

// tiny seeded RNG (mulberry32) so the shuffle is stable for a given seed
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher–Yates using provided rng()
function shuffleWithRng(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


/** ---------- App with exponential zoom ---------- */
export default function App() {
  // const [builders, setBuilders] = useState(5);
  const [jsonData, setJsonData] = React.useState(null);
  const [jsonValid, setJsonValid] = React.useState(false);

  const [tasks, setTasks] = useState([]);
  const [makespan, setMakespan] = useState(0);
  const [err, setErr] = useState(false);
  const [scheduleType, setScheduleType] = useState("Longest Processing Time (LPT)");

  // Zoom mapping (exponential)
  const MIN = 0.005;
  const MAX = 7;
  const DEFAULT_PX_PER_SEC = 0.03;

  const toPxPerSec = (z) => MIN * Math.pow(MAX / MIN, z);
  const toZoom = (p) => Math.log(p / MIN) / Math.log(MAX / MIN);

  const [zoom, setZoom] = useState(() => toZoom(DEFAULT_PX_PER_SEC));
  const pxPerSec = toPxPerSec(zoom);

  // UI helpers
  const pxPerHour = Math.round(pxPerSec * 3600);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const zoomIn = () => setZoom((z) => clamp01(z + 0.08));
  const zoomOut = () => setZoom((z) => clamp01(z - 0.08));
  const reset = () => setZoom(toZoom(DEFAULT_PX_PER_SEC));

  const handleGenerateSPT = () => {
    console.log('generating')
    if (!jsonData) { setErr(true); return; }
    const { sch, err } = generateSchedule(jsonData, "SPT");
    setErr(err);
    setTasks(sch.schedule);
    setMakespan(sch.makespan);
    setScheduleType("Shortest Processing Time (SPT)");
  };

  const handleGenerateLPT = () => {
    if (!jsonData) { setErr(true); return; }
    const { sch, err } = generateSchedule(jsonData, "LPT");
    setErr(err);
    setTasks(sch.schedule);
    setMakespan(sch.makespan);
    setScheduleType("Longest Processing Time (LPT)");
  };

  const colorMapRef = useRef({});     // { [id]: "#hex" }
  const paletteRef = useRef([]);     // shuffled colors

  useEffect(() => {
    // Seed from crypto (falls back to Date.now if unavailable)
    let seed = Date.now();
    try {
      const u32 = new Uint32Array(1);
      crypto.getRandomValues(u32);
      seed = u32[0] || seed;
    } catch { }
    const rng = mulberry32(seed);
    paletteRef.current = shuffleWithRng(PALETTE, rng);
  }, []);

  // Call this to get a color for any id (assigns once, then reuses)
  const colorForId = (id) => {
    const key = String(id);
    const m = colorMapRef.current;
    if (!m[key]) {
      const nextIdx = Object.keys(m).length % (paletteRef.current.length || PALETTE.length);
      const palette = paletteRef.current.length ? paletteRef.current : PALETTE;
      m[key] = palette[nextIdx];
    }
    return m[key];
  };


  return (
    <div className={clsx("app-wrap", "light")}
      style={{ minHeight: "100vh", background: undefined }}>
      <div className="card" style={{ boxShadow: "0 8px 32px rgba(37,99,235,0.10)", borderRadius: 18 }}>
        <div className="header" style={{
          background: "linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)",
          borderRadius: "12px",
          padding: "24px 24px 18px 24px",
          color: "#fff",
          marginBottom: 18,
          boxShadow: "0 4px 16px rgba(37,99,235,0.10)",
          position: "relative"
        }}>
          <div className="title" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-1px" }}>Upgrade Optimizer</div>
          <div className="subtitle" style={{ fontSize: 15, color: "#e0e7ff", marginTop: 4 }}>Plan, visualize, and optimize your build queue</div>
          {/* <button
            className="button ghost"
            style={{ position: "absolute", top: 24, right: 24, fontSize: 14, padding: "6px 14px" }}
            onClick={() => setDark(d => !d)}
            aria-label="Toggle dark mode"
          >{dark ? "☀️ Light" : "🌙 Dark"}</button> */}
        </div>

        {/* Controls */}
        <div className="field" style={{ maxWidth: "100vw", marginBottom: 18 }}>
          <JsonInput
            label="Paste village JSON data"
            initial='[{"id":"Cannon","start":0,"end":3600}]'
            onValid={setJsonData}
            onValidityChange={setJsonValid}
          />
        </div>
        <div className="controls" style={{ marginBottom: 18 }}>


          <button disabled={!jsonValid} className="button" style={{ fontSize: 16, padding: "12px 22px", borderRadius: 12 }} onClick={handleGenerateSPT}>Generate SPT</button>
          <button disabled={!jsonValid} className="button" style={{ fontSize: 16, padding: "12px 22px", borderRadius: 12 }} onClick={handleGenerateLPT}>Generate LPT</button>

        </div>

        {/* Metrics */}
        {tasks.length > 0 && (
          <div className="metrics" style={{ marginTop: 18, marginBottom: 10 }}>
            <div className="pill" style={{ fontSize: 15, background: "#eef2ff", color: "#3730a3" }}>{scheduleType}</div>
          </div>
        )}

        {err[0] && (<div className="metrics" style={{ marginTop: 10, marginBottom: 10 }}>
          <div className="pill" style={{ fontSize: 15, background: "#eef2ff", color: "#3730a3" }}>{err[0] ? err[1] : "There was an error parsing your JSON!"}</div>
        </div>)}

        {/* Metrics */}
        {tasks.length > 0 && (
          <div className="metrics" style={{ marginTop: 10, marginBottom: 10 }}>
            <div className="pill" style={{ fontSize: 15, background: "#eef2ff", color: "#3730a3" }}>Makespan: {makespan}</div>
          </div>
        )}

        {tasks.length > 0 && (
          <div style={{
            maxHeight: "50vh",   // adjust how tall you want it
            overflowY: "auto",
            paddingRight: 6,      // avoid scrollbar overlap
            border: "2px solid #7096e7ff",
            borderRadius: 12
          }}>
            <TimelineCards tasks={tasks} colorForId={colorForId} />
          </div>

        )}


        {tasks.length > 0 && (
          <div className="metrics" style={{ marginTop: 22, marginBottom: 12 }}>
            <div className="pill" style={{ fontSize: 15, background: "#eef2ff", color: "#3730a3" }}>Schedule Chart</div>
          </div>
        )}

        {/* Exponential Zoom */}
        <div className="slider-group" title="Zoom timeline" style={{ minWidth: 320, maxWidth: 506, marginBottom: 12 }}>
          <button className="button secondary" style={{ fontSize: 16 }} onClick={zoomOut} aria-label="Zoom out">–</button>
          <input
            className="range"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <button className="button secondary" style={{ fontSize: 16 }} onClick={zoomIn} aria-label="Zoom in">+</button>
          <button className="button ghost" style={{ fontSize: 14 }} onClick={reset}>Reset</button>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {pxPerHour} px/hr · {(zoom * 100).toFixed(0)}%
          </span>
        </div>

        {/* Chart */}
        <div className="chart-shell" style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 12px #e0e7ff" }}>
          <GanttChart tasks={tasks} groupBy="worker" pxPerSec={pxPerSec} colorForId={colorForId} />
        </div>

      </div>
    </div >
  );
}