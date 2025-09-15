// BuilderTimeline.jsx
import React, { useEffect, useRef } from 'react';
import { DataSet, Timeline } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import { BUILDING_COLORS } from './colorMap';

function formatDuration(seconds) {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (d) return `${d}d ${h}h ${m ? m + 'm' : ''}`.trim();
	if (h) return `${h}h ${m ? m + 'm' : ''}`.trim();
	if (m) return `${m}m ${s ? s + 's' : ''}`.trim();
	return `${s}s`;
}

export default function BuilderTimeline({ tasks = [], height = 520 }) {
	const ref = useRef(null);
	const timelineRef = useRef(null);

	useEffect(() => {
		if (!ref.current) return;

		// destroy previous timeline if any
		if (timelineRef.current) {
			try {
				timelineRef.current.destroy();
			} catch {}
			timelineRef.current = null;
		}

		// build builder groups from `worker` indices (keeps original ordering)
		const workers = Array.from(
			new Set(tasks.map((t) => Number(t.worker || 0)))
		);
		const groups = workers.map((w) => ({
			id: w,
			content: `<b>Builder ${Number(w) + 1}</b>`,
		}));

		// create items for vis-timeline
		const items = tasks.map((t, i) => {
			const start = new Date((t.start || 0) * 1000);
			const endEpoch =
				t.end != null ? Number(t.end) : (t.start || 0) + (t.duration || 0);
			const end = new Date(Number(endEpoch) * 1000);

			const nameKey = t.id || t.text || t.name || '';
			const color = BUILDING_COLORS[nameKey] || '#60a5fa'; // fallback blue

			const label = `${String(t.id).replaceAll('_', ' ')}${
				t.level ? ` L${t.level}` : ''
			} ${t.iter ? `#${t.iter}` : ''}`;
			const durLabel = formatDuration(
				Number(t.duration || endEpoch - (t.start || 0))
			);
			const content = `${label} (${durLabel})`;

			return {
				id: t.key || t.id || `task-${i}`,
				group: Number(t.worker || 0),
				start,
				end,
				content,
				style: `
					background: ${color};
					border: 1px solid #0f172a;
					border-radius: 6px;
					color: #fff;
					font-size: 12px;
					font-weight: 600;
					padding: 2px 6px;
					white-space: nowrap;
				`,
			};
		});

		const minStart = Math.min(...tasks.map((t) => t.start)) * 1000; // ms
		const maxEnd = Math.max(...tasks.map((t) => t.end)) * 1000; // ms
		const scheduleSpan = maxEnd - minStart;
		const container = ref.current;
		const options = {
			maxHeight: 600,
			autoResize: true,
			stack: false,
			groupHeightMode: 'auto',
			margin: {
				item: { vertical: 12 }, // 👈 adds vertical padding inside each row
			},
			orientation: { item: 'top' },
			horizontalScroll: true,
			horizontalScrollInvert: true,
			zoomKey: 'ctrlKey',
			zoomable: true,
			zoomMax: scheduleSpan,
			zoomMin: 3600000,
			min: new Date(),
			start: new Date(),
			end: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
		};

		timelineRef.current = new Timeline(
			container,
			new DataSet(items),
			new DataSet(groups),
			options
		);

		// minimal CSS for bars + labels
		const styleId = 'gantt-color-styles';
		const oldStyle = document.getElementById(styleId);
		if (oldStyle) oldStyle.remove();

		const styleEl = document.createElement('style');
		styleEl.id = styleId;
		styleEl.textContent = `
      .vis-item {
        border-radius: 4px;
        color: #0f172a !important;
        font-size: 12px;
        font-weight: 600;
        padding: 2px 6px;
        white-space: nowrap;
      }
      .vis-item .vis-item-content {
        background: transparent !important;
      }
      .vis-timeline {
        border: none !important;
      }
      .vis-panel.vis-left,
      .vis-panel.vis-right,
      .vis-panel.vis-top,
      .vis-panel.vis-bottom {
        border: none !important;
      }
    `;
		document.head.appendChild(styleEl);

		return () => {
			try {
				timelineRef.current.destroy();
			} catch {}
			if (styleEl && styleEl.parentNode) {
				styleEl.parentNode.removeChild(styleEl);
			}
		};
	}, [tasks, height]);

	return (
		<div
			style={{
				padding: 10,
				width: '100%',
				border: '1px solid #e6edf3',
				borderRadius: 8,
				background: '#fff',
			}}
		>
			<div ref={ref} />
		</div>
	);
}
