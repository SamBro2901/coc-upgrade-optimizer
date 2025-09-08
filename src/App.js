import React, { useEffect, useMemo, useState } from "react";
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
  doneKeys, onToggle, taskKeyFn,
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
            const isDone = doneKeys?.has(taskKeyFn(t));
            const hrs = formatTime(t.duration); //Math.round(((t.end - t.start) / 3600) * 10) / 10
            const label = `${t.id} L${t.level} ${t.iter} (${hrs})`;
            return (
              <g key={i}>
                <rect x={x} y={y} width={w} height={rowHeight - 8} rx="6" ry="6" fill={fill} opacity="0.92" style={{
                  cursor: onToggle ? "pointer" : "default",
                  opacity: isDone ? 0.45 : 0.9,
                  filter: isDone ? "grayscale(100%) brightness(0.9)" : "none",
                  transition: "opacity 300ms ease, filter 300ms ease"
                }}
                  onClick={() => onToggle?.(t)} />
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

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 15 }}>
        <button onClick={handleFormat} style={btnSecondary}>Format</button>
        <button onClick={handleClear} style={btnGhost}>Clear</button>

        <span style={{ marginLeft: 15, fontSize: 12, color: isValid ? "#16a34a" : "#ef4444", fontWeight: 600 }}>
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
  "#A1C9F5",
  "#B3E0C9",
  "#89D9D9",
  "#C4E8D7",
  "#A4E5F5",
  "#F6C8E6",
  "#E0BBE4",
  "#F5C5C7",
  "#D0B4F5",
  "#F5D6E1",
  "#FDFD96",
  "#FEE1C7",
  "#FAD2A6",
  "#FCE7A4",
  "#FFDDAA",
  "#C9D7F5",
  "#BDECB6",
  "#FAD2D4",
  "#D4A5A5",
  "#A2CFFE",
  "#CEF6D3",
  "#D9B3E0",
  "#D2C4D2",
  "#FBC0B3",
  "#FFB7B2",
  "#B8D8F4",
  "#B2EBF2",
  "#ECC9EE",
  "#DDA0DD",
  "#FAD4D4"
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

const taskKey = (t) => `${t.id}|L${t.level}|w${t.worker}|${t.start}-${t.end}`;

/** ---------- App with exponential zoom ---------- */
export default function App() {
  // const [builders, setBuilders] = useState(5);
  const [jsonData, setJsonData] = React.useState(null);
  const [jsonValid, setJsonValid] = React.useState(false);
  const [doneKeys, setDoneKeys] = React.useState(() => new Set());

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

  const colorMapRef = React.useRef({});  // persistent mapping
  const paletteRef = React.useRef([...PALETTE]); // simple copy

  const colorForId = (id) => {
    const m = colorMapRef.current;
    if (!m[id]) {
      const nextIdx = Object.keys(m).length % paletteRef.current.length;
      m[id] = paletteRef.current[nextIdx];
    }
    return m[id];
  };

  const [zoom, setZoom] = useState(() => toZoom(DEFAULT_PX_PER_SEC));
  const pxPerSec = toPxPerSec(zoom);

  const toggleDone = (task) => {
    const k = taskKey(task);
    setDoneKeys(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  // UI helpers
  const pxPerHour = Math.round(pxPerSec * 3600);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const zoomIn = () => setZoom((z) => clamp01(z + 0.08));
  const zoomOut = () => setZoom((z) => clamp01(z - 0.08));
  const reset = () => setZoom(toZoom(DEFAULT_PX_PER_SEC));

  const runSchedule = (jD, strategy) => {
    if (!jD) {
      console.error("No JSON data provided");
      setErr(true);
      return;
    }
    const { sch, err } = generateSchedule(jsonData, strategy);
    setErr(err);
    setTasks(sch.schedule);
    setMakespan(sch.makespan);
    setScheduleType(strategy === "SPT" ? "Shortest Processing Time (SPT)" : "Longest Processing Time (LPT)");

    // 🔑 ensure all ids get mapped now
    sch.schedule.forEach(t => { colorForId(t.id); });
  };

  // const handleGenerateSPT = () => {
  //   if (!jsonData) { setErr(true); return; }
  //   const { sch, err } = generateSchedule(jsonData, "SPT");
  //   setErr(err);
  //   setTasks(sch.schedule);
  //   setMakespan(sch.makespan);
  //   setScheduleType("Shortest Processing Time (SPT)");
  // };

  // const handleGenerateLPT = () => {
  //   if (!jsonData) { setErr(true); return; }
  //   const { sch, err } = generateSchedule(jsonData, "LPT");
  //   setErr(err);
  //   setTasks(sch.schedule);
  //   setMakespan(sch.makespan);
  //   setScheduleType("Longest Processing Time (LPT)");
  // };

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
  // const colorForId = (id) => {
  //   const key = String(id);
  //   const m = colorMapRef.current;
  //   if (!m[key]) {
  //     const nextIdx = Object.keys(m).length % (paletteRef.current.length || PALETTE.length);
  //     const palette = paletteRef.current.length ? paletteRef.current : PALETTE;
  //     m[key] = palette[nextIdx];
  //   }
  //   return m[key];
  // };


  return (
    <div className={clsx("app-wrap", "light")}
      style={{ minHeight: "100vh", background: undefined }}>
      <div className="card" style={{ boxShadow: "0 8px 32px rgba(37,99,235,0.10)", borderRadius: 18 }}>
        <div className="header" style={{
          background: "linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)",
          borderRadius: "12px",
          padding: "24px",
          color: "#fff",
          marginBottom: 18,
          boxShadow: "0 4px 16px rgba(37,99,235,0.10)",
          position: "relative"
        }}>
          <div className="title" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-1px" }}>Upgrade Optimizer</div>
          <div className="subtitle" style={{ fontSize: 15, color: "#e0e7ff", justifyItems: "center" }}>Plan, visualize, and optimize your build queue</div>
          {/* <button
            className="button ghost"
            style={{ position: "absolute", top: 24, right: 24, fontSize: 14, padding: "6px 14px" }}
            onClick={() => setDark(d => !d)}
            aria-label="Toggle dark mode"
          >{dark ? "☀️ Light" : "🌙 Dark"}</button> */}
        </div>

        <div className="field" style={{ padding: 10 }}>
          <h2 style={{ marginTop: 10, marginBottom: 10 }}>Introduction</h2>
          This tool provides an efficient way to plan your Clash of Clans home village upgrades, helping you find the most optimal path to a maxed-out base. It takes your village data and generates two detailed upgrade schedules: one prioritizing the <b>shortest possible time</b> and another for the <b>longest possible time</b>, giving you flexibility in your strategy. You can find more info <b><a href="https://github.com/SamBro2901/coc-upgrade-optimizer" target="_blank" rel="noreferrer">here</a></b>.

          <h3 style={{ marginTop: 25, marginBottom: 10 }}>How to Use</h3>
          <ol style={{ paddingLeft: 30 }}>
            <li><b style={{ color: "#000000ff" }}>Extract your JSON data:</b> Go to your in-game settings and tap on the <b>"More Settings"</b> button. On this page, scroll down until you find the <b>"Data Export"</b> section and click on the <b>"Copy"</b> button.</li>
            <li><b style={{ color: "#000000ff" }}>Paste and validate the data:</b> Once you have the JSON copied to your clipboard, paste the data in the text box below. You can see if the data you pasted is valid by reading the feedback under the text box.</li>
            <li><b style={{ color: "#000000ff" }}>Generate the schedule:</b> Click on either the <b>"Generate SPT"</b> or <b>"Generate LPT"</b> button to generate the respective upgrade schedule.</li>
            <li><b style={{ color: "#000000ff" }}>Timeline Cards & Chart:</b> Both timeline cards and timeline chart are generated. The cards make the upgrades more readable since smaller upgrades can appear very small in the chart. You can freely click on each card to mark them as completed for your own tracking purposes.</li>
          </ol>
        </div>

        {/* Controls */}
        <div className="field">
          <JsonInput
            label="Paste village JSON data"
            initial='{"tag":"#GU2QV0Y8Q","timestamp":1757084582,"buildings":[{"data":1000008,"lvl":10,"gear_up":1},{"data":1000011,"lvl":5,"timer":24973},{"data":1000019,"lvl":4,"timer":28511},{"data":1000019,"lvl":4,"timer":28517},{"data":1000005,"lvl":8,"timer":12591},{"data":1000011,"lvl":4,"timer":5143},{"data":1000000,"lvl":6,"cnt":4},{"data":1000001,"lvl":8,"cnt":1},{"data":1000002,"lvl":11,"cnt":6},{"data":1000003,"lvl":8,"cnt":1},{"data":1000003,"lvl":11,"cnt":2},{"data":1000004,"lvl":11,"cnt":2},{"data":1000004,"lvl":12,"cnt":4},{"data":1000005,"lvl":11,"cnt":2},{"data":1000006,"lvl":10,"cnt":1},{"data":1000007,"lvl":6,"cnt":1},{"data":1000008,"lvl":10,"cnt":4},{"data":1000009,"lvl":9,"cnt":5},{"data":1000010,"lvl":8,"cnt":225},{"data":1000011,"lvl":6,"cnt":1},{"data":1000012,"lvl":6,"cnt":3},{"data":1000013,"lvl":6,"cnt":4},{"data":1000014,"lvl":4,"cnt":1},{"data":1000015,"lvl":1,"cnt":5},{"data":1000019,"lvl":1,"cnt":1},{"data":1000020,"lvl":3,"cnt":1},{"data":1000023,"lvl":3,"cnt":2},{"data":1000024,"lvl":4,"cnt":1},{"data":1000026,"lvl":4,"cnt":1},{"data":1000028,"lvl":4,"cnt":1},{"data":1000029,"lvl":2,"cnt":1},{"data":1000032,"lvl":2,"cnt":1},{"data":1000070,"lvl":1,"cnt":1},{"data":1000071,"lvl":2,"cnt":1}],"traps":[{"data":12000000,"lvl":5,"cnt":6},{"data":12000001,"lvl":1,"cnt":2},{"data":12000001,"lvl":2,"cnt":4},{"data":12000002,"lvl":1,"cnt":1},{"data":12000002,"lvl":2,"cnt":2},{"data":12000005,"lvl":1,"cnt":2},{"data":12000005,"lvl":3,"cnt":2},{"data":12000006,"lvl":1,"cnt":2},{"data":12000008,"lvl":1,"cnt":2}],"decos":[{"data":18000184,"cnt":1}],"obstacles":[{"data":8000000,"cnt":5},{"data":8000004,"cnt":3},{"data":8000006,"cnt":3},{"data":8000007,"cnt":1},{"data":8000008,"cnt":3},{"data":8000010,"cnt":6},{"data":8000013,"cnt":2},{"data":8000131,"cnt":2}],"units":[{"data":4000000,"lvl":4},{"data":4000001,"lvl":4},{"data":4000002,"lvl":4},{"data":4000003,"lvl":4},{"data":4000004,"lvl":4},{"data":4000005,"lvl":4,"timer":17157},{"data":4000006,"lvl":5},{"data":4000007,"lvl":2},{"data":4000008,"lvl":3},{"data":4000009,"lvl":2,"timer":4931},{"data":4000010,"lvl":2},{"data":4000011,"lvl":4},{"data":4000012,"lvl":2},{"data":4000013,"lvl":2}],"siege_machines":[],"heroes":[{"data":28000000,"lvl":11},{"data":28000001,"lvl":6}],"spells":[{"data":26000000,"lvl":4},{"data":26000001,"lvl":4},{"data":26000002,"lvl":5},{"data":26000009,"lvl":2},{"data":26000010,"lvl":2}],"pets":[],"equipment":[{"data":90000000,"lvl":1},{"data":90000001,"lvl":1},{"data":90000002,"lvl":1},{"data":90000003,"lvl":1},{"data":90000004,"lvl":1},{"data":90000005,"lvl":1},{"data":90000006,"lvl":1},{"data":90000007,"lvl":1},{"data":90000008,"lvl":5},{"data":90000010,"lvl":1},{"data":90000013,"lvl":1},{"data":90000014,"lvl":5},{"data":90000015,"lvl":1},{"data":90000019,"lvl":1},{"data":90000022,"lvl":1},{"data":90000032,"lvl":1},{"data":90000035,"lvl":1},{"data":90000039,"lvl":1},{"data":90000040,"lvl":1},{"data":90000041,"lvl":1},{"data":90000042,"lvl":1},{"data":90000043,"lvl":1},{"data":90000048,"lvl":1}],"house_parts":[82000000,82000008,82000009,82000011,82000048,82000058,82000059],"skins":[],"sceneries":[],"buildings2":[{"data":1000039,"lvl":2,"timer":198},{"data":1000033,"lvl":3,"cnt":75},{"data":1000034,"lvl":4,"cnt":1},{"data":1000035,"lvl":4,"cnt":1},{"data":1000036,"lvl":3,"cnt":1},{"data":1000037,"lvl":4,"cnt":1},{"data":1000038,"lvl":4,"cnt":1},{"data":1000040,"lvl":6,"cnt":1},{"data":1000041,"lvl":4,"cnt":1},{"data":1000042,"lvl":1,"cnt":4},{"data":1000043,"lvl":2,"cnt":1},{"data":1000044,"lvl":3,"cnt":2},{"data":1000046,"lvl":4,"cnt":1},{"data":1000048,"lvl":3,"cnt":2},{"data":1000050,"lvl":1,"cnt":1},{"data":1000051,"lvl":2,"cnt":1},{"data":1000054,"lvl":2,"cnt":1},{"data":1000055,"lvl":2,"cnt":1},{"data":1000058,"lvl":2,"cnt":1}],"traps2":[{"data":12000010,"lvl":1,"cnt":2},{"data":12000011,"lvl":1,"cnt":2},{"data":12000011,"lvl":2,"cnt":1},{"data":12000013,"lvl":1,"cnt":3},{"data":12000014,"lvl":1,"cnt":1}],"decos2":[],"obstacles2":[{"data":8000041,"cnt":8},{"data":8000042,"cnt":1},{"data":8000047,"cnt":1},{"data":8000049,"cnt":3},{"data":8000050,"cnt":2},{"data":8000051,"cnt":1},{"data":8000053,"cnt":1},{"data":8000055,"cnt":1},{"data":8000056,"cnt":2},{"data":8000057,"cnt":5},{"data":8000058,"cnt":7},{"data":8000059,"cnt":4},{"data":8000060,"cnt":3},{"data":8000061,"cnt":1},{"data":8000062,"cnt":2},{"data":8000063,"cnt":13},{"data":8000064,"cnt":12}],"units2":[{"data":4000031,"lvl":6},{"data":4000032,"lvl":6},{"data":4000033,"lvl":8},{"data":4000034,"lvl":7},{"data":4000035,"lvl":5},{"data":4000041,"lvl":6,"timer":55487}],"heroes2":[],"skins2":[],"sceneries2":[]}'
            onValid={setJsonData}
            onValidityChange={setJsonValid}
          />
          <div className="controls">
            <button disabled={!jsonValid} className="button" style={{ fontSize: 16, padding: "12px 22px", borderRadius: 12 }} onClick={() => runSchedule(jsonData, "SPT")}>Generate SPT</button>
            <button disabled={!jsonValid} className="button" style={{ fontSize: 16, padding: "12px 22px", borderRadius: 12 }} onClick={() => runSchedule(jsonData, "LPT")}>Generate LPT</button>
          </div>
        </div>

        {err[0] && (<div className="metrics" style={{ marginTop: 10, marginBottom: 10 }}>
          <div className="pill" style={{ fontSize: 15, background: "#da7474ff", color: "#e72121ff" }}>{err[0] ? err[1] : "There was an error parsing your JSON!"}</div>
        </div>)}

        {tasks.length > 0 && (
          <div>

            <div className="field">
              <h2 style={{ paddingLeft: 8, marginTop: 10, marginBottom: 10, color: "#3730a3" }}>Timeline Cards</h2>

              <div>
                <div className="timeline-header" >
                  <div className="metrics" style={{ marginTop: 10, marginBottom: 10 }}>
                    <div className="pill" style={{ background: "#eef2ff" }}>Makespan: {makespan}</div>
                  </div>
                  <span style={{ marginLeft: "auto" }}>
                    <div className="metrics" style={{ marginTop: 10, marginBottom: 10 }}>
                      <div className="pill" style={{ background: "#eef2ff" }}>{scheduleType}</div>
                    </div>
                  </span>
                </div>
                <div style={{
                  maxHeight: "50vh",   // adjust how tall you want it
                  overflowY: "auto",
                  paddingRight: 6,      // avoid scrollbar overlap
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  marginBottom: 20
                }}>
                  <TimelineCards tasks={tasks} colorForId={colorForId} doneKeys={doneKeys} onToggle={toggleDone} taskKeyFn={taskKey} />
                </div>
              </div>
            </div>

            <div className="field">
              <h2 style={{ paddingLeft: 8, marginTop: 10, marginBottom: 10, color: "#3730a3" }}>Timeline Chart</h2>

              <div className="timeline-header" >
                <div className="metrics" style={{ marginTop: 10, marginBottom: 10 }}>
                  <div className="pill" style={{ background: "#eef2ff" }}>Makespan: {makespan}</div>
                </div>
                <span style={{ marginLeft: "auto" }}>
                  <div className="metrics" style={{ marginTop: 10, marginBottom: 10 }}>
                    <div className="pill" style={{ background: "#eef2ff" }}>{scheduleType}</div>
                  </div>
                </span>
              </div>

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
              <div className="chart-shell" style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 12px #e0e7ff" }}>
                <GanttChart tasks={tasks} groupBy="worker" pxPerSec={pxPerSec} colorForId={colorForId} doneKeys={doneKeys} onToggle={toggleDone} taskKeyFn={taskKey} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div >
  );
}