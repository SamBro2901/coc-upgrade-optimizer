import React from 'react';

function formatDuration(seconds) {
	const days = Math.floor(seconds / (24 * 60 * 60));
	seconds %= 24 * 60 * 60;

	const hours = Math.floor(seconds / 3600);
	seconds %= 3600;

	const minutes = Math.floor(seconds / 60);
	seconds %= 60;

	const parts = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	if (seconds > 0) parts.push(`${seconds}s`);

	return parts.length > 0 ? parts.join(' ') : '0s';
}

function formatClockOrDate(epochSec, prevEpochSec = null) {
	const d = new Date(epochSec * 1000);

	const hh = String(d.getHours()).padStart(2, '0');
	const mm = String(d.getMinutes()).padStart(2, '0');
	const timeStr = `${hh}:${mm}`;

	// If day changed since previous tick
	if (prevEpochSec != null) {
		const prev = new Date(prevEpochSec * 1000);
		const dayChanged =
			d.getDate() !== prev.getDate() ||
			d.getMonth() !== prev.getMonth() ||
			d.getFullYear() !== prev.getFullYear();

		if (dayChanged) {
			const dd = String(d.getDate()).padStart(2, '0');
			const mon = String(d.getMonth() + 1).padStart(2, '0');
			return { date: `${dd}/${mon}`, time: timeStr, isDate: true };
		}
	}

	// Default → only time
	return { date: null, time: timeStr, isDate: false };
}

export function TimelineCards({
	tasks = [],
	colorForId,
	doneKeys,
	onToggle,
	taskKeyFn,
}) {
	if (!tasks.length) return null;

	// Chronological order
	const sorted = [...tasks].sort((a, b) => a.start - b.start);
	const workers = tasks.map((item) => item.worker);
	const numWorkers = [...new Set(workers)];
	let makespan = [];

	for (let w of numWorkers) {
		const currMake = tasks
			.filter((t) => t.worker === w)
			.reduce((sum, t) => sum + t.duration, 0);
		makespan[w] = currMake;
	}

	return (
		<div style={{ display: 'grid', gap: 10 }}>
			{sorted.map((t, i) => {
				const dur = Math.max(0, t.duration);
				// % of total schedule for width and left offset
				const k = taskKeyFn(t);
				const isDone = doneKeys?.has(k);
				const workerTasks = sorted.filter((x) => x.worker === t.worker);
				const workerStart = Math.min(...workerTasks.map((x) => x.start));
				const workerEnd = Math.max(...workerTasks.map((x) => x.end));
				const workerSpan = workerEnd - workerStart || 1; // avoid /0

				const widthPct = (t.duration / workerSpan) * 100;
				const leftPct = ((t.start - workerStart) / workerSpan) * 100;

				return (
					<div
						key={k}
						className={`timeline-card ${isDone ? 'done' : ''}`}
						onClick={() => onToggle?.(t)}
						role="button"
						aria-pressed={isDone}
						title={isDone ? 'Click to unmark' : 'Click to mark as done'}
						style={{
							background: colorForId(t.id),
							borderRadius: 10,
						}}
					>
						<div style={{ fontWeight: 600, fontSize: 15 }}>
							{String(t.id).replaceAll('_', ' ')} · L{t.level}
						</div>
						<div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
							Builder {Number(t.worker) + 1} · #{t.iter}
						</div>

						{(() => {
							const nowEpoch = Math.floor(Date.now() / 1000);
							const startEpoch = nowEpoch + t.start;
							const endEpoch = nowEpoch + t.end;

							const startLabel = formatClockOrDate(startEpoch);
							const endLabel = formatClockOrDate(endEpoch, startEpoch);

							return (
								<div style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>
									<span>
										{startLabel.date && (
											<span style={{ fontWeight: 700 }}>{startLabel.date}</span>
										)}
										{startLabel.date ? ` ${startLabel.time}` : startLabel.time}
									</span>
									{' → '}
									<span>
										{endLabel.date && (
											<span style={{ fontWeight: 700 }}>{endLabel.date}</span>
										)}
										{endLabel.date ? ` ${endLabel.time}` : endLabel.time}
									</span>
								</div>
							);
						})()}

						<div style={{ fontSize: 13, color: '#475569' }}>
							Duration: {formatDuration(dur)}
						</div>

						{/* Track represents the whole schedule window; bar shows task position + length */}
						<div
							style={{
								marginTop: 10,
								height: 10,
								background: '#f1f5f9',
								borderRadius: 999,
								position: 'relative',
								overflow: 'hidden',
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
									position: 'absolute',
									left: `${leftPct}%`,
									width: `${widthPct}%`,
									top: 0,
									bottom: 0,
									background: '#3b82f6', // tweak or map color per id if you like
								}}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}
