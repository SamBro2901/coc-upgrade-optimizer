import React, { useState, useEffect } from 'react';

export default function ActiveTimeInput({
	onChange,
	defaultStart = '08:00',
	defaultEnd = '22:00',
	storageKey = 'activeTime',
}) {
	// Load saved values from localStorage (or fallback to defaults)
	const loadFromStorage = () => {
		try {
			const saved = JSON.parse(localStorage.getItem(storageKey));
			if (saved && saved.start && saved.end) {
				return saved;
			}
		} catch {}
		return {
			enabled: false,
			start: defaultStart,
			end: defaultEnd,
		};
	};

	const initial = loadFromStorage();

	const [enabled, setEnabled] = useState(initial.enabled);
	const [startHour, setStartHour] = useState(
		initial.start ? initial.start.split(':')[0] : defaultStart.split(':')[0]
	);
	const [startMinute, setStartMinute] = useState(
		initial.start ? initial.start.split(':')[1] : defaultStart.split(':')[1]
	);
	const [endHour, setEndHour] = useState(
		initial.end ? initial.end.split(':')[0] : defaultEnd.split(':')[0]
	);
	const [endMinute, setEndMinute] = useState(
		initial.end ? initial.end.split(':')[1] : defaultEnd.split(':')[1]
	);

	const formatValue = (value) => {
		if (value === '') return '';
		return String(value).padStart(2, '0');
	};

	const toMinutes = (h, m) =>
		parseInt(h || '0', 10) * 60 + parseInt(m || '0', 10);

	const fromMinutes = (mins) => {
		const h = Math.floor(mins / 60) % 24;
		const m = mins % 60;
		return [formatValue(h), formatValue(m)];
	};

	const handleBlur = (setter, value, max, type) => {
		let num = parseInt(value, 10);
		if (isNaN(num)) {
			setter('');
			return;
		}
		if (num < 0) num = 0;
		if (num > max) num = max;
		setter(formatValue(num));

		// Enforce 1-hour minimum gap
		const startTotal = toMinutes(startHour, startMinute);
		const endTotal = toMinutes(endHour, endMinute);

		if (type === 'end') {
			if (endTotal < startTotal + 60) {
				const [h, m] = fromMinutes(startTotal + 60);
				setEndHour(h);
				setEndMinute(m);
			}
		}

		if (type === 'start') {
			if (endTotal < startTotal + 60) {
				const [h, m] = fromMinutes(startTotal + 60);
				setEndHour(h);
				setEndMinute(m);
			}
		}
	};

	// Notify parent + persist in localStorage
	useEffect(() => {
		const payload = {
			enabled,
			start:
				enabled && startHour !== '' && startMinute !== ''
					? `${formatValue(startHour)}:${formatValue(startMinute)}`
					: null,
			end:
				enabled && endHour !== '' && endMinute !== ''
					? `${formatValue(endHour)}:${formatValue(endMinute)}`
					: null,
		};

		try {
			localStorage.setItem(storageKey, JSON.stringify(payload));
		} catch {}

		onChange?.(payload);
	}, [
		enabled,
		startHour,
		startMinute,
		endHour,
		endMinute,
		onChange,
		storageKey,
	]);

	return (
		<div style={{ width: '100%' }}>
			<span className="builder-bonus-label">Active Time Range</span>
			<label
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 6,
					marginTop: 10,
					marginBottom: 10,
				}}
			>
				<input
					type="checkbox"
					checked={enabled}
					onChange={(e) => setEnabled(e.target.checked)}
				/>
				Enable Active Time
			</label>

			<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
				{/* Start Time */}
				<div className="active-time-container">
					<label>Start Time</label>
					<div style={{ display: 'flex', gap: 5, padding: 5 }}>
						<input
							type="number"
							min="0"
							max="23"
							value={startHour}
							onChange={(e) => setStartHour(e.target.value)}
							onBlur={() => handleBlur(setStartHour, startHour, 23, 'start')}
							placeholder="HH"
							disabled={!enabled}
							style={{ width: 38 }}
						/>
						:
						<input
							type="number"
							min="0"
							max="59"
							value={startMinute}
							onChange={(e) => setStartMinute(e.target.value)}
							onBlur={() =>
								handleBlur(setStartMinute, startMinute, 59, 'start')
							}
							placeholder="MM"
							disabled={!enabled}
							style={{ width: 38 }}
						/>
					</div>
				</div>

				{/* End Time */}
				<div className="active-time-container">
					<label>End Time</label>
					<div style={{ display: 'flex', gap: 5, padding: 5 }}>
						<input
							type="number"
							min="0"
							max="23"
							value={endHour}
							onChange={(e) => setEndHour(e.target.value)}
							onBlur={() => handleBlur(setEndHour, endHour, 23, 'end')}
							placeholder="HH"
							disabled={!enabled}
							style={{ width: 38 }}
						/>
						:
						<input
							type="number"
							min="0"
							max="59"
							value={endMinute}
							onChange={(e) => setEndMinute(e.target.value)}
							onBlur={() => handleBlur(setEndMinute, endMinute, 59, 'end')}
							placeholder="MM"
							disabled={!enabled}
							style={{ width: 38 }}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
