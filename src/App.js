import React, { useState } from "react";
import clsx from "clsx";
import { generateSchedule } from './scheduler.js';
import "./App.css";
import { BUILDING_COLORS } from "./colorMap";
import { TimelineCards } from "./TimelineCards.jsx";
import BuilderTimeline from "./BuilderTimeline.jsx";
import ActiveTimeInput from "./ActiveTimeInput.jsx";


export function JsonInput({ label = "JSON Input", initial = "", onValid, onValidityChange, storageKey = "JSON" }) {
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  // Initialize text from localStorage → initial → default ""
  const [text, setText] = React.useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);

        // Check timestamp validity
        if (parsed.timestamp) {
          const age = Date.now() - new Date(parsed.timestamp).getTime();
          if (age > SIX_HOURS_MS) {
            console.warn("Stored JSON expired. Clearing localStorage.");
            localStorage.removeItem(storageKey);
          } else {
            return stored;
          }
        } else {
          // No timestamp field → keep it (optional)
          return stored;
        }
      }

      if (typeof initial === "string") return initial;
      return initial ? JSON.stringify(initial, null, 2) : "";
    } catch (err) {
      console.error("Error loading from localStorage:", err);
      return "";
    }
  });

  const [error, setError] = React.useState("");
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
        onValid?.(obj);
        localStorage.setItem(storageKey, JSON.stringify(obj, null, 2));
      } catch {
        /* should not happen since isValid is true */
      }
    }
  }, [isValid, text, onValid, onValidityChange, storageKey]);

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
    localStorage.removeItem(storageKey);
  };

  return (
    <div style={{ display: "grid", gap: 8, width: "100%" }}>
      <span className="builder-bonus-label">Paste your village JSON data</span>
      {/* <label style={{ fontSize: 13, color: "#64748b" }}>{label}</label> */}

      <textarea
        ref={areaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        // onMouseUp={saveSize}                 // save new size after drag
        placeholder='{"foo": 1, "bar": [2,3]}'
        spellCheck={false}
        style={{
          display: "block",                   // stays in normal flow so others reflow
          width: "100%",               // initial/persisted size
          height: "20vh",
          // minWidth: "30vw",
          minHeight: "10vh",
          // maxWidth: "100%",    // 👈 cap width
          maxHeight: "20vh",
          boxSizing: "border-box",
          resize: "none",                     // 👈 enables horizontal + vertical resize
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
// const PALETTE = [
//   "#A1C9F5", "#B3E0C9", "#89D9D9", "#C4E8D7", "#A4E5F5", "#F6C8E6", "#E0BBE4", "#F5C5C7",
//   "#D0B4F5", "#F5D6E1", "#FDFD96", "#FEE1C7", "#FAD2A6", "#FCE7A4", "#FFDDAA", "#C9D7F5",
//   "#BDECB6", "#FAD2D4", "#D4A5A5", "#A2CFFE", "#CEF6D3", "#D9B3E0", "#D2C4D2", "#FBC0B3",
//   "#FFB7B2", "#B8D8F4", "#B2EBF2", "#ECC9EE", "#DDA0DD", "#FAD4D4"
// ];

const taskKey = (t) => `${t.id}|L${t.level}|w${t.worker}|${t.start}-${t.end}`;

// ---- zoom constants + helpers ----
const MIN = 0.005;
const MAX = 7;

export const toPxPerSec = (z) => MIN * Math.pow(MAX / MIN, z);
export const toZoom = (p) => Math.log(p / MIN) / Math.log(MAX / MIN);

// clamp normalized zoom to [ZOOM_MIN, ZOOM_MAX]
const ZOOM_MIN = 0.01;
const ZOOM_MAX = 0.9;
export const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));


/** ---------- App with exponential zoom ---------- */
export default function App() {
  // const [builders, setBuilders] = useState(5);
  const [jsonData, setJsonData] = React.useState(null);
  const [jsonValid, setJsonValid] = React.useState(false);
  const [doneKeys, setDoneKeys] = React.useState(() => new Set());

  const [tasks, setTasks] = useState([]);
  const [makespan, setMakespan] = useState(0);
  const [startTime, setStartTime] = useState(Math.floor(Date.now() / 1000));
  const [err, setErr] = useState(false);
  const [scheduleType, setScheduleType] = useState("Longest Processing Time (LPT)");
  const [dynamicHeight, setHeight] = useState(300);
  const [activeTime, setActiveTime] = useState({ enabled: false, start: null, end: null });

  const [selectedPct, setSelectedPct] = useState(() => {
    const saved = localStorage.getItem("builderBonusPct");
    return saved ? Number(saved) : 0; // default 0% if nothing saved
  });

  const [village, setVillage] = useState(() => {
    const saved = localStorage.getItem("baseVillage");
    return saved ? String(saved) : "home";
  })

  const [priority, setPriority] = useState(() => {
    const saved = localStorage.getItem("fixedPriority");
    return saved ? saved === "true" : false;
  });

  React.useEffect(() => {
    localStorage.setItem("builderBonusPct", selectedPct);
    localStorage.setItem("baseVillage", village);
    localStorage.setItem("fixedPriority", priority ? "true" : "false");
  }, [selectedPct, village, priority]);



  const colorForId = (name) => {
    return BUILDING_COLORS[name] || "#94a3b8"; // fallback gray
  };

  const toggleDone = (task) => {
    const k = taskKey(task);
    setDoneKeys(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const runSchedule = (jD, strategy) => {
    if (!jD) {
      console.error("No JSON data provided");
      setErr(true);
      return;
    }
    let activeWindowStart = activeTime.enabled ? activeTime.start : "00:00";
    let activeWindowEnd = activeTime.enabled ? activeTime.end : "23:59";
    const { sch, numBuilders, startTime, err } = generateSchedule(jsonData, false, strategy, priority, village, selectedPct, activeWindowStart, activeWindowEnd);
    setErr(err);
    setTasks(sch.schedule);
    setMakespan(sch.makespan);
    setStartTime(startTime);
    setScheduleType(strategy === "SPT" ? "Shortest Processing Time (SPT)" : "Longest Processing Time (LPT)");
    const rowHeight = 40;
    const basePadding = 90; // space for axis/labels
    setHeight(numBuilders * rowHeight + basePadding);

    sch.schedule.forEach(t => { colorForId(t.id); });
  };


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
        <div className="field" style={{ maxWidth: "100%" }}>
          <div className="input-div" style={{ marginBottom: 20 }}>
            <div className="active-time-container" style={{ maxWidth: 936 }}>
              <JsonInput
                label="Paste village JSON data"
                initial={`{"tag":"#GU2QV0Y8Q","timestamp":${Math.floor(Date.now() / 1000)},"buildings":[{"data":1000008,"lvl":10,"gear_up":1},{"data":1000011,"lvl":5,"timer":24973},{"data":1000019,"lvl":4,"timer":28511},{"data":1000019,"lvl":4,"timer":28517},{"data":1000005,"lvl":8,"timer":12591},{"data":1000011,"lvl":4,"timer":5143},{"data":1000000,"lvl":6,"cnt":4},{"data":1000001,"lvl":8,"cnt":1},{"data":1000002,"lvl":11,"cnt":6},{"data":1000003,"lvl":8,"cnt":1},{"data":1000003,"lvl":11,"cnt":2},{"data":1000004,"lvl":11,"cnt":2},{"data":1000004,"lvl":12,"cnt":4},{"data":1000005,"lvl":11,"cnt":2},{"data":1000006,"lvl":10,"cnt":1},{"data":1000007,"lvl":6,"cnt":1},{"data":1000008,"lvl":10,"cnt":4},{"data":1000009,"lvl":9,"cnt":5},{"data":1000010,"lvl":8,"cnt":225},{"data":1000011,"lvl":6,"cnt":1},{"data":1000012,"lvl":6,"cnt":3},{"data":1000013,"lvl":6,"cnt":4},{"data":1000014,"lvl":4,"cnt":1},{"data":1000015,"lvl":1,"cnt":5},{"data":1000019,"lvl":1,"cnt":1},{"data":1000020,"lvl":3,"cnt":1},{"data":1000023,"lvl":3,"cnt":2},{"data":1000024,"lvl":4,"cnt":1},{"data":1000026,"lvl":4,"cnt":1},{"data":1000028,"lvl":4,"cnt":1},{"data":1000029,"lvl":2,"cnt":1},{"data":1000032,"lvl":2,"cnt":1},{"data":1000070,"lvl":1,"cnt":1},{"data":1000071,"lvl":2,"cnt":1}],"traps":[{"data":12000000,"lvl":5,"cnt":6},{"data":12000001,"lvl":1,"cnt":2},{"data":12000001,"lvl":2,"cnt":4},{"data":12000002,"lvl":1,"cnt":1},{"data":12000002,"lvl":2,"cnt":2},{"data":12000005,"lvl":1,"cnt":2},{"data":12000005,"lvl":3,"cnt":2},{"data":12000006,"lvl":1,"cnt":2},{"data":12000008,"lvl":1,"cnt":2}],"decos":[{"data":18000184,"cnt":1}],"obstacles":[{"data":8000000,"cnt":5},{"data":8000004,"cnt":3},{"data":8000006,"cnt":3},{"data":8000007,"cnt":1},{"data":8000008,"cnt":3},{"data":8000010,"lvl":6},{"data":8000013,"cnt":2},{"data":8000131,"cnt":2}],"units":[{"data":4000000,"lvl":4},{"data":4000001,"lvl":4},{"data":4000002,"lvl":4},{"data":4000003,"lvl":4},{"data":4000004,"lvl":4},{"data":4000005,"lvl":4,"timer":17157},{"data":4000006,"lvl":5},{"data":4000007,"lvl":2},{"data":4000008,"lvl":3},{"data":4000009,"lvl":2,"timer":4931},{"data":4000010,"lvl":2},{"data":4000011,"lvl":4},{"data":4000012,"lvl":2},{"data":4000013,"lvl":2}],"siege_machines":[],"heroes":[{"data":28000000,"lvl":11},{"data":28000001,"lvl":6}],"spells":[{"data":26000000,"lvl":4},{"data":26000001,"lvl":4},{"data":26000002,"lvl":5},{"data":26000009,"lvl":2},{"data":26000010,"lvl":2}],"pets":[],"equipment":[{"data":90000000,"lvl":1},{"data":90000001,"lvl":1},{"data":90000002,"lvl":1},{"data":90000003,"lvl":1},{"data":90000004,"lvl":1},{"data":90000005,"lvl":1},{"data":90000006,"lvl":1},{"data":90000007,"lvl":1},{"data":90000008,"lvl":5},{"data":90000010,"lvl":1},{"data":90000013,"lvl":1},{"data":90000014,"lvl":5},{"data":90000015,"lvl":1},{"data":90000019,"lvl":1},{"data":90000022,"lvl":1},{"data":90000032,"lvl":1},{"data":90000035,"lvl":1},{"data":90000039,"lvl":1},{"data":90000040,"lvl":1},{"data":90000041,"lvl":1},{"data":90000042,"lvl":1},{"data":90000043,"lvl":1},{"data":90000048,"lvl":1}],"house_parts":[82000000,82000008,82000009,82000011,82000048,82000058,82000059],"skins":[],"sceneries":[],"buildings2":[{"data":1000039,"lvl":2,"timer":198},{"data":1000033,"lvl":3,"cnt":75},{"data":1000034,"lvl":4,"cnt":1},{"data":1000035,"lvl":4,"cnt":1},{"data":1000036,"lvl":3,"cnt":1},{"data":1000037,"lvl":4,"cnt":1},{"data":1000038,"lvl":4,"cnt":1},{"data":1000040,"lvl":6,"cnt":1},{"data":1000041,"lvl":4,"cnt":1},{"data":1000042,"lvl":1,"cnt":4},{"data":1000043,"lvl":2,"cnt":1},{"data":1000044,"lvl":3,"cnt":2},{"data":1000046,"lvl":4,"cnt":1},{"data":1000048,"lvl":3,"cnt":2},{"data":1000050,"lvl":1,"cnt":1},{"data":1000051,"lvl":2,"cnt":1},{"data":1000054,"lvl":2,"cnt":1},{"data":1000055,"lvl":2,"cnt":1},{"data":1000058,"lvl":2,"cnt":1}],"traps2":[{"data":12000010,"lvl":1,"cnt":2},{"data":12000011,"lvl":1,"cnt":2},{"data":12000011,"lvl":2,"cnt":1},{"data":12000013,"lvl":1,"cnt":3},{"data":12000014,"lvl":1,"cnt":1}],"decos2":[],"obstacles2":[{"data":8000041,"cnt":8},{"data":8000042,"cnt":1},{"data":8000047,"cnt":1},{"data":8000049,"cnt":3},{"data":8000050,"cnt":2},{"data":8000051,"cnt":1},{"data":8000053,"cnt":1},{"data":8000055,"cnt":1},{"data":8000056,"cnt":2},{"data":8000057,"cnt":5},{"data":8000058,"cnt":7},{"data":8000059,"cnt":4},{"data":8000060,"cnt":3},{"data":8000061,"cnt":1},{"data":8000062,"cnt":2},{"data":8000063,"cnt":13},{"data":8000064,"cnt":12}],"units2":[{"data":4000031,"lvl":6},{"data":4000032,"lvl":6},{"data":4000033,"lvl":8},{"data":4000034,"lvl":7},{"data":4000035,"lvl":5},{"data":4000041,"lvl":6,"timer":55487}],"heroes2":[],"skins2":[],"sceneries2":[]}`}
                onValid={setJsonData}
                onValidityChange={setJsonValid}
              />
            </div>

            <div className="input-div-inner">
              <div className="active-time-container" style={{ padding: 10, minWidth: 270, maxWidth: 270, height: 220 }}>
                <ActiveTimeInput onChange={setActiveTime} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 20 }}>
                <div className="builder-bonus-container" style={{ width: 270, height: 60 }}>
                  <span className="builder-bonus-label">Builder Bonus:</span>
                  <select
                    value={selectedPct}
                    onChange={(e) => setSelectedPct(Number(e.target.value))}
                    className="builder-bonus-container"
                  >
                    <option value={0}>0%</option>
                    <option value={0.05}>5%</option>
                    <option value={0.10}>10%</option>
                    <option value={0.15}>15%</option>
                    <option value={0.20}>20%</option>
                    <option value={0.25}>25%</option>
                    <option value={0.30}>30%</option>
                    <option value={0.35}>35%</option>
                    <option value={0.40}>40%</option>
                    <option value={0.45}>45%</option>
                    <option value={0.50}>50%</option>
                  </select>
                </div>
                <div className="builder-bonus-container" style={{ width: 270, maxWidth: 270, height: 60 }}>
                  <span className="builder-bonus-label">Select Village:</span>
                  <select
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="builder-bonus-container"
                  >
                    <option value={"home"}>Home Village</option>
                    <option value={"builder"}>Builder Base</option>
                  </select>
                </div>
                <div className="builder-bonus-container" style={{ width: 270, maxWidth: 270, height: 60 }}>
                  <span className="builder-bonus-label">Use Fixed Priority</span>
                  <input
                    type="checkbox"
                    checked={priority}
                    onChange={(e) => setPriority(e.target.checked)}
                    style={{ transform: "scale(1.2)" }}
                  />
                </div>
              </div>
            </div>

          </div>

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
              <span>Tip: Pinch or Ctrl + Mouse Wheel to zoom in and out</span>
              <div className="chart-shell" style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 12px #e0e7ff" }}>
                <BuilderTimeline tasks={tasks} start={startTime} height={dynamicHeight} doneKeys={doneKeys} onToggle={toggleDone} taskKeyFn={taskKey} />
              </div>
            </div>


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
          </div>
        )}
      </div>
    </div >
  );
}