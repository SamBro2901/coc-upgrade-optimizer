import React from "react";

function formatHMS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h ? `${h}h` : "", m ? `${m}m` : "", !h && !m ? `${s}s` : ""]
    .filter(Boolean)
    .join(" ");
}

// const taskKey = (t) => `${t.id}|L${t.level}|w${t.worker}|${t.start}-${t.end}`;

export function TimelineCards({ tasks = [], colorForId, doneKeys, onToggle, taskKeyFn }) {
  // const [done, setDone] = React.useState(() => new Set());

  if (!tasks.length) return null;

  // Chronological order
  const sorted = [...tasks].sort((a, b) => a.start - b.start);
  const workers = tasks.map(item => item.worker);
  const numWorkers = [...new Set(workers)];
  let makespan = [];

  for( let w of numWorkers){
    const currMake = tasks.filter(t=>t.worker === w).reduce((sum, t)=> sum+t.duration, 0);
    makespan[w] = currMake;
  }

  // const toggleDone = (k) => {
  //   setDone(prev => {
  //     const next = new Set(prev);
  //     if (next.has(k)) next.delete(k); else next.add(k);
  //     return next;
  //   });
  // };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {sorted.map((t, i) => {
        const dur = Math.max(0, t.duration);
        // % of total schedule for width and left offset
        const k = taskKeyFn(t);
        const isDone = doneKeys?.has(k);
        const widthPct = Math.min(100, (t.duration / makespan[t.worker]) * 100);
        const leftPct  = Math.min(100, (t.start / makespan[t.worker]) * 100);

        return (
          <div
            key={k}
            className={`timeline-card ${isDone ? "done" : ""}`}
            onClick={() => onToggle?.(t)}
            role="button"
            aria-pressed={isDone}
            title={isDone ? "Click to unmark" : "Click to mark as done"}
            style={{
              background: colorForId(t.id),
              borderRadius: 10
            }}
          >
          {/* <div
            key={i}
            style={{
              border: "1px solid #b7b8bbff",
              borderRadius: 12,
              background: colorForId(t.id),
              padding: 12,
              marginRight: 1,
              marginTop: 4,
              marginLeft: 4,
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            }}
          > */}
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {t.id} · L{t.level}
            </div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
              Builder {Number(t.worker) + 1} · Class {t.iter}
            </div>

            <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
              {formatHMS(t.start)} → {formatHMS(t.end)}
            </div>
            <div style={{ fontSize: 13, color: "#475569" }}>
              Duration: {formatHMS(dur)}
            </div>

            {/* Track represents the whole schedule window; bar shows task position + length */}
            <div
              style={{
                marginTop: 10,
                height: 10,
                background: "#f1f5f9",
                borderRadius: 999,
                position: "relative",
                overflow: "hidden",
              }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(widthPct)}
              aria-label={`${t.id} duration relative to schedule`}
              title={`${Math.round(widthPct)}% of makespan`}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: 0,
                  bottom: 0,
                  background: "#3b82f6", // tweak or map color per id if you like
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
