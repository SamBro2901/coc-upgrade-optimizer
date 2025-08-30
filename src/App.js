import React, { useMemo, useState } from "react";
import clsx from "clsx";
import { generateSchedule } from './scheduler.js';
import "./App.css";

function formatTime(val) {
  if (val < 60) return `${val.toFixed(2)}s`;
  if (val < 3600) return `${(val / 60).toFixed(2)}m`;
  return `${(val / 3600)}h`;
}

/** ---------- GanttChart component (SVG) ---------- */
function GanttChart({
  tasks,
  groupBy = "worker",
  pxPerSec = 0.03,
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

  const colorMap = React.useMemo(() => {
    const palette = [
      "#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF", "#E3BAFF", "#FFD6E0", "#C7FFD8", "#FFF5BA", "#BAFFD6",
      "#D6FFBA", "#FFBABA", "#BAE7FF", "#E0BAFF", "#FFE0BA", "#BAFFD4", "#FFBAF2", "#E0FFBA", "#BAC2FF", "#FFC2BA"
    ];
    const map = {};
    uniqueIds.forEach((id, i) => { map[id] = palette[i % palette.length]; });
    return map;
  }, [uniqueIds]);

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
            const row = groups.indexOf(String(t[groupBy]));
            const y = axisHeight + row * (rowHeight + rowGap) + 4;
            const x = 120 + (t.start - minStart) * pxPerSec;
            const w = Math.max(2, (t.end - t.start) * pxPerSec);
            const hrs = formatTime(t.duration); //Math.round(((t.end - t.start) / 3600) * 10) / 10
            const label = `${t.id} L${t.level} (${hrs})`;
            return (
              <g key={i}>
                <rect x={x} y={y} width={w} height={rowHeight - 8} rx="6" ry="6" fill={colorMap[t.id]} opacity="0.92" style={{ cursor: "pointer" }} />
                <rect x={x} y={y} width={w} height={rowHeight - 8} rx="6" ry="6" fill="none" stroke="rgba(0,0,0,0.15)" />
                <clipPath id={`clip-${i}`}>
                  <rect x={x + 6} y={y} width={Math.max(0, w - 12)} height={rowHeight - 8} />
                </clipPath>
                <text x={x + 10} y={y + (rowHeight - 8) * 0.62} fontSize="13" fontWeight={500} fill="#0f172a" clipPath={`url(#clip-${i})`}>
                  {label}
                </text>
                <title>{`${t.id} L${t.level}\n• Builder ${t.worker}\n• Group: ${t.iter}\n•start ${formatTime(t.start)} • end ${formatTime(t.end)}\nduration ${formatTime(t.duration)}`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      <Legend
        items={uniqueIds.map(id => ({
          label: id,
          color: colorMap[id]
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

/** ---------- App with exponential zoom ---------- */
export default function App() {
  const [dark, setDark] = useState(false);
  const [currentTH, setCurrentTH] = useState(7);
  const [targetTH, setTargetTH] = useState(8);
  const [builders, setBuilders] = useState(5);

  const [tasks, setTasks] = useState([]);
  const [makespan, setMakespan] = useState(0);

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
    const currTH = Number(currentTH);
    const nextTH = Number(targetTH);
    const workers = Number(builders);

    const schedule = generateSchedule(currTH, nextTH, workers, "SPT");

    setTasks(schedule.schedule);
    setMakespan(schedule.makespan);
  };

  const handleGenerateLPT = () => {
    const currTH = Number(currentTH);
    const nextTH = Number(targetTH);
    const workers = Number(builders);

    const schedule = generateSchedule(currTH, nextTH, workers, "LPT");

    setTasks(schedule.schedule);
    setMakespan(schedule.makespan);
  }

  return (
    <div className={clsx("app-wrap", dark && "dark")}
      style={{ minHeight: "100vh", background: dark ? "var(--bg)" : undefined }}>
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
          <div className="title" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-1px" }}>Upgrade Planner</div>
          <div className="subtitle" style={{ fontSize: 15, color: "#e0e7ff", marginTop: 4 }}>Plan, visualize, and optimize your build queue</div>
          {/* <button
            className="button ghost"
            style={{ position: "absolute", top: 24, right: 24, fontSize: 14, padding: "6px 14px" }}
            onClick={() => setDark(d => !d)}
            aria-label="Toggle dark mode"
          >{dark ? "☀️ Light" : "🌙 Dark"}</button> */}
        </div>

        {/* Controls */}
        <div className="controls" style={{ marginBottom: 18 }}>
          <div className="field" style={{ minWidth: 180 }}>
            <label>Current Town Hall</label>
            <input type="number" value={currentTH} onChange={e => setCurrentTH(Number(e.target.value))} />
          </div>

          <div className="field" style={{ minWidth: 180 }}>
            <label>Target Town Hall</label>
            <input type="number" value={targetTH} onChange={e => setTargetTH(Number(e.target.value))} />
          </div>

          <div className="field" style={{ minWidth: 180 }}>
            <label>Number of Builders</label>
            <input type="number" value={builders} onChange={e => setBuilders(Number(e.target.value))} />
          </div>

          <button className="button" style={{ fontSize: 16, padding: "12px 22px", borderRadius: 12 }} onClick={handleGenerateSPT}>Generate SPT</button>
          <button className="button" style={{ fontSize: 16, padding: "12px 22px", borderRadius: 12 }} onClick={handleGenerateLPT}>Generate LPT</button>

          {/* Exponential Zoom */}
          <div className="slider-group" title="Zoom timeline" style={{ minWidth: 220 }}>
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
        </div>

        {/* Chart */}
        <div className="chart-shell" style={{ background: dark ? "#0b1220" : "#fff", borderRadius: 16, boxShadow: dark ? "0 2px 12px #111827" : "0 2px 12px #e0e7ff" }}>
          <GanttChart tasks={tasks} groupBy="worker" pxPerSec={pxPerSec} />
        </div>

        {/* Metrics */}
        {tasks.length > 0 && (
          <div className="metrics" style={{ marginTop: 18 }}>
            <div className="pill" style={{ fontSize: 15, background: dark ? "#1e293b" : "#eef2ff", color: dark ? "#e0e7ff" : "#3730a3" }}>Makespan: {makespan}</div>
          </div>
        )}
      </div>
    </div>
  );
}