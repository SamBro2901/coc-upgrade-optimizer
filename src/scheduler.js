import defenseConfig from './data/defenses.json' with { type: "json" };
import trapConfig from './data/traps.json' with { type: "json" };
import resConfig from './data/resources.json' with { type: "json" };
import armyConfig from './data/army.json' with { type: "json" };
import thConfig from './data/th.json' with { type: "json" };

function arrayToObject(arr) {
	return arr.reduce((acc, item) => {
		const key = Object.keys(item)[0];
		acc[key] = item[key];
		return acc;
	}, {});
}

function objToArray(task, qty, char = 65) {
	const arr = Array.from({ length: qty }, (_, i) => {
		const mark = task.map(obj => ({
			...obj,
			iter: String.fromCharCode(char)
		}));
		char++;
		return mark;
	}
	).flat();
	return { arr, char };
}

// function loadJSON(filePath) {
// 	const full = path.resolve(filePath);
// 	const raw = fs.readFileSync(full, "utf-8");
// 	return JSON.parse(raw);
// }

function constructTasks(currTH, nextTH) {
	let itemData = { ...defenseConfig, ...trapConfig, ...resConfig, ...armyConfig };
	// for (const i of dataJSON) {
	// 	itemData = { ...itemData, ...loadJSON(i) };
	// }
	// const full = path.resolve(THJSON);
	// const raw = fs.readFileSync(full, "utf-8");
	// const thData = JSON.parse(raw);
	const thData = thConfig;
	const tasks = [];

	const nextQty = arrayToObject(thData[nextTH]);
	const currQty = arrayToObject(thData[currTH]);
	let difference = {};
	for (let key in nextQty) {
		const nextval = nextQty[key];
		const currval = currQty[key] || 0;
		const diff = nextval - currval;

		if (diff !== 0) {
			difference[key] = diff;
		}
	}

	for (const [key, value] of Object.entries(nextQty)) {
		if (key === "Walls") continue; // skip walls
		const build = itemData[key];
		if (!build) {
			console.warn(`Warning: No build data for ${key}`);
			continue;
		}
		let char = 65
		// New Buildings
		if (difference[key] !== 0) {

			const filter = build.filter(item => item.TH > 0 && item.TH <= nextTH);
			if (filter.length === 0) {
				console.warn(`Warning: No upgrade data for ${key} from TH${currTH} to TH${nextTH}`);
				continue;
			}
			const task = filter.map(item => ({ id: key, level: item.id, duration: item.duration }));
			const qty = difference[key] || 0;
			let resp = objToArray(task, qty, char);
			tasks.push(...resp.arr);
			char = resp.char
		}

		//Existing Buildings
		const filter1 = build.filter(item => item.TH > currTH && item.TH <= nextTH);
		if (filter1.length === 0) {
			console.warn(`Warning: No upgrade data for ${key} from TH${currTH} to TH${nextTH}`);
			continue;
		}
		const task1 = filter1.map(item => ({ id: key, level: item.id, duration: item.duration }));
		let qty1 = value
		if (difference[key]) {
			qty1 -= difference[key]
		}
		let resp1 = objToArray(task1, qty1, char);

		tasks.push(...resp1.arr);
	}

	return { tasks: tasks };
}


function scheduleSPT(tasks, numWorkers) {
	if (!Array.isArray(tasks) || tasks.length === 0) {
		return { schedule: [], makespan: 0 };
	}
	if (!Number.isInteger(numWorkers) || numWorkers <= 0) {
		throw new Error("numWorkers must be a positive integer");
	}

	const normalized = tasks.map((t, idx) => ({
		...t,
		_idx: idx,
		level: typeof t.level === "string" ? parseInt(t.level, 10) : t.level,
	}));

	const key = (id, iter, level) => `${id}||${iter}||${level}`;
	const indexByKey = new Map();
	for (let i = 0; i < normalized.length; i++) {
		const t = normalized[i];
		indexByKey.set(key(t.id, t.iter, t.level), i);
	}

	const predecessor = new Array(normalized.length).fill(null);
	const successors = Array.from({ length: normalized.length }, () => []);
	for (let i = 0; i < normalized.length; i++) {
		const t = normalized[i];
		const predIdx = indexByKey.get(key(t.id, t.iter, t.level - 1));
		if (typeof predIdx === "number") {
			predecessor[i] = predIdx;
			successors[predIdx].push(i);
		}
	}

	const completedAt = new Array(normalized.length).fill(-1);
	const earliestStart = normalized.map((_, i) =>
		typeof predecessor[i] === "number" ? Infinity : 0
	);

	const released = new Set();
	for (let i = 0; i < normalized.length; i++) {
		if (earliestStart[i] === 0) released.add(i);
	}

	const running = [];
	const freeWorkers = Array.from({ length: numWorkers }, (_, w) => w);

	function pickReadyTasks(currentTime) {
		const ready = [];
		for (const i of released) {
			if (earliestStart[i] <= currentTime) {
				ready.push(i);
			}
		}
		ready.sort((a, b) => {
			const da = normalized[a].duration;
			const db = normalized[b].duration;
			if (da !== db) return da - db;
			return normalized[a]._idx - normalized[b]._idx;
		});
		return ready;
	}

	const scheduled = new Array(normalized.length).fill(false);
	const result = [];
	let time = 0;
	let regenerateScheduleing = normalized.length;

	while (regenerateScheduleing > 0) {
		// let assignedThisRound = false;
		while (freeWorkers.length > 0) {
			const ready = pickReadyTasks(time);
			if (ready.length === 0) break;
			const idx = ready[0];
			released.delete(idx);

			const w = freeWorkers.pop();
			const start = Math.max(time, earliestStart[idx]);
			const end = start + normalized[idx].duration;

			running.push({ idx, worker: w, end });
			scheduled[idx] = true;
			// assignedThisRound = true;

			result.push({
				id: normalized[idx].id,
				level: normalized[idx].level,
				iter: normalized[idx].iter,
				duration: normalized[idx].duration,
				worker: w,
				start,
				end,
			});
		}

		if (regenerateScheduleing === 0) break;

		if (running.length === 0) {
			let nextTime = Infinity;
			for (const i of released) {
				if (earliestStart[i] < nextTime) nextTime = earliestStart[i];
			}
			if (!isFinite(nextTime)) {
				throw new Error(
					"Deadlock detected: tasks have unmet dependencies. Check your (id, iter, level) chains."
				);
			}
			time = nextTime;
			continue;
		}

		running.sort((a, b) => a.end - b.end);
		const next = running.shift();
		time = next.end;

		completedAt[next.idx] = time;
		freeWorkers.push(next.worker);
		regenerateScheduleing--;

		for (const succ of successors[next.idx]) {
			if (earliestStart[succ] === Infinity) {
				earliestStart[succ] = time;
				released.add(succ);
			}
		}
	}

	result.sort((a, b) => (a.start - b.start) || (a.worker - b.worker));
	let makespan = result.reduce((m, r) => Math.max(m, r.end), 0);
	makespan = formatTime(makespan);
	return { schedule: result, makespan };
}

// Schedules Longest Processing Time first with the same precedence semantics as scheduleSPT
function scheduleLPT(tasks, numWorkers) {
	if (!Array.isArray(tasks) || tasks.length === 0) {
		return { schedule: [], makespan: 0 };
	}
	if (!Number.isInteger(numWorkers) || numWorkers <= 0) {
		throw new Error("numWorkers must be a positive integer");
	}

	// Normalize and keep original index for stable tie-breaking
	const normalized = tasks.map((t, idx) => ({
		...t,
		_idx: idx,
		level: typeof t.level === "string" ? parseInt(t.level, 10) : t.level,
	}));

	// Build predecessor/successor links by (id, iter, level)
	const key = (id, iter, level) => `${id}||${iter}||${level}`;
	const indexByKey = new Map();
	for (let i = 0; i < normalized.length; i++) {
		const t = normalized[i];
		indexByKey.set(key(t.id, t.iter, t.level), i);
	}

	const predecessor = new Array(normalized.length).fill(null);
	const successors = Array.from({ length: normalized.length }, () => []);
	for (let i = 0; i < normalized.length; i++) {
		const t = normalized[i];
		const predIdx = indexByKey.get(key(t.id, t.iter, t.level - 1));
		if (typeof predIdx === "number") {
			predecessor[i] = predIdx;
			successors[predIdx].push(i);
		}
	}

	// earliestStart enforces:
	// - root levels can start at time 0
	// - next level can start only after the *finish time* of its predecessor
	const earliestStart = normalized.map((_, i) =>
		typeof predecessor[i] === "number" ? Infinity : 0
	);

	// Released tasks are those whose chain root is known; they become "ready"
	// once earliestStart <= current time.
	const released = new Set();
	for (let i = 0; i < normalized.length; i++) {
		if (earliestStart[i] === 0) released.add(i);
	}

	const running = [];
	const freeWorkers = Array.from({ length: numWorkers }, (_, w) => w);

	// Pick ready tasks by LPT (longest duration first), then stable by original index
	function pickReadyTasks(currentTime) {
		const ready = [];
		for (const i of released) {
			if (earliestStart[i] <= currentTime) ready.push(i);
		}
		ready.sort((a, b) => {
			const da = normalized[a].duration;
			const db = normalized[b].duration;
			if (da !== db) return db - da;           // DESC for LPT
			return normalized[a]._idx - normalized[b]._idx; // stable tie-break
		});
		return ready;
	}

	const result = [];
	let time = 0;
	let remaining = normalized.length;

	while (remaining > 0) {
		// Assign as many ready tasks as possible
		while (freeWorkers.length > 0) {
			const ready = pickReadyTasks(time);
			if (ready.length === 0) break;

			const idx = ready[0];
			released.delete(idx);

			const w = freeWorkers.pop();
			const start = Math.max(time, earliestStart[idx]);
			const end = start + normalized[idx].duration;

			running.push({ idx, worker: w, end });

			result.push({
				id: normalized[idx].id,
				level: normalized[idx].level,
				iter: normalized[idx].iter,
				duration: normalized[idx].duration,
				worker: w,
				start,
				end,
			});
		}

		if (remaining === 0) break;

		if (running.length === 0) {
			// No tasks running and none ready: jump to the next release time or fail if impossible
			let nextTime = Infinity;
			for (const i of released) {
				if (earliestStart[i] < nextTime) nextTime = earliestStart[i];
			}
			if (!isFinite(nextTime)) {
				throw new Error(
					"Deadlock detected: tasks have unmet dependencies. Check your (id, iter, level) chains."
				);
			}
			time = nextTime;
			continue;
		}

		// Advance time to the next finishing task
		running.sort((a, b) => a.end - b.end);
		const next = running.shift();
		time = next.end;
		freeWorkers.push(next.worker);
		remaining--;

		// Release successors: they can start only after predecessor's end (= time)
		for (const succ of successors[next.idx]) {
			if (earliestStart[succ] === Infinity) {
				earliestStart[succ] = time; // enforce "only after deadline/finish"
				released.add(succ);
			}
		}
	}

	result.sort((a, b) => (a.start - b.start) || (a.worker - b.worker));
	let makespan = result.reduce((m, r) => Math.max(m, r.end), 0);
	makespan = formatTime(makespan);
	return { schedule: result, makespan };
}


function formatTime(val) {
	if (val < 60) return `${val.toFixed(2)}s`;
	if (val < 3600) return `${(val / 60).toFixed(2)}m`;
	return `${(val / 3600).toFixed(2)}h`;
}

// function printSchedule(schedule, printbyWorker = false) {
// 	if (!Array.isArray(schedule) || schedule.length === 0) {
// 		console.log("No tasks scheduled.");
// 		return;
// 	}

// 	console.log("=== Task Schedule ===");
// 	console.log(
// 		"Worker |  Task ID      | Level | Iter | Duration | Start | End"
// 	);
// 	console.log("------- | ------------- | ----- | ---- | -------- | ----- | ---");

// 	if (printbyWorker) {
// 		schedule = schedule.sort((a, b) => a.worker - b.worker || a.start - b.start);

// 	}

// 	for (const t of schedule) {
// 		console.log(
// 			`${t.worker.toString().padEnd(6)} | ${t.id.padEnd(12)} | ${t.level
// 				.toString()
// 				.padEnd(5)} | ${t.iter.padEnd(4)} | ${t.duration_iso.padEnd(8)} | ${t.start_iso.padEnd(7)} | ${t.end_iso}`
// 		);
// 	}
// }

function toISOString(seconds) {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;

	let iso = "P";
	if (d > 0) iso += d + "D";

	if (h > 0 || m > 0 || s > 0) {
		iso += "T";
		if (h > 0) iso += h + "H";
		if (m > 0) iso += m + "M";
		if (s > 0 || iso === "P") iso += s + "S";
	}

	return iso;
}


export function generateSchedule(currTH, nextTH, builders, scheme = 'LPT') {

	const { tasks } = constructTasks(currTH, nextTH);
	// const numWorkers = 5

	// const schedule = scheduleSPT(tasks, builders);
	// console.log("\n=== SPT with Precedence Constraints ===");

	const schedule = scheduleLPT(tasks, builders);
	// console.log("\n=== LPT with Precedence Constraints ===");

	for (const t of schedule.schedule) {
		t.start_iso = toISOString(t.start);
		t.end_iso = toISOString(t.end);
		t.duration_iso = toISOString(t.duration);
	}

	// console.log(`\nTotal project time (makespan): ${formatTime(schedule.makespan)}`);
	// printSchedule(schedule.schedule);

	const schedule2 = scheduleSPT(tasks, builders);
	// console.log("\n=== SPT with Precedence Constraints ===");

	for (const t of schedule2.schedule) {
		t.start_iso = toISOString(t.start);
		t.end_iso = toISOString(t.end);
		t.duration_iso = toISOString(t.duration);
	}

	// console.log(`\nTotal project time (makespan): ${formatTime(schedule2.makespan)}`);
	// printSchedule(schedule2.schedule);

	return scheme === 'LPT' ? schedule : schedule2;

}

generateSchedule(6, 7, 5);