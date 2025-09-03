import defenseConfig from './data/defenses.json' with { type: "json" };
import trapConfig from './data/traps.json' with { type: "json" };
import resConfig from './data/resources.json' with { type: "json" };
import armyConfig from './data/army.json' with { type: "json" };
import thConfig from './data/th.json' with { type: "json" };
import mapping from './data/mapping.json' with { type: "json" };

// import playerData from './data/coc_data.json' with { type: "json" };

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

function constructTasks(inputData, currTH) {
	let itemData = { ...defenseConfig, ...trapConfig, ...resConfig, ...armyConfig };

	let pData = inputData.buildings;
	let buildData = [], buildings = [], tasks = [];
	for (let item of pData) {
		if (mapping[item.data] === undefined) continue;
		if (!buildings.includes(mapping[item.data])) buildings.push(mapping[item.data])

		buildData.push({ ...item, name: mapping[item.data] });
	}

	currTH = buildData.find(b => b.name === 'TownHall')?.lvl || currTH;
	buildData = buildData.filter(b => b.name !== 'TownHall');
	const maxBuilds = arrayToObject(thConfig[currTH])

	for (let b of buildings) {
		let currBuild = buildData.filter(i => i.name === b);
		let currCount = 0, char = 65;
		if (currBuild.length !== 0) {
			currCount = currBuild.reduce((sum, v) => sum + (v.cnt || v.gear_up), 0);
		}

		// Missing Buildings
		if (currCount < maxBuilds[b]) {
			const task = itemData[b].filter(item => item.TH > 0 && item.TH <= currTH).map(item => ({ id: b, level: item.id, duration: item.duration, priority: 2 }));
			const resp = objToArray(task, maxBuilds[b] - currCount, char);
			char = resp.char;
			tasks.push(...resp.arr);
		}

		// Existing Buildings
		for (let c of currBuild) {
			// Currently upgrading buildings
			if (c.timer) {
				let task = { id: b, level: String(c.lvl), duration: c.timer, priority: 1, iter: String.fromCharCode(char) };
				tasks.push(task);
				char++;
				continue;
			}

			let currTask = itemData[b]?.filter(item => item.TH === currTH)?.sort((a, b) => b.id - a.id).map(item => ({ id: b, level: item.id, duration: item.duration }))[0];
			let missingLvls = currTask?.level - c.lvl || 0;
			if (missingLvls > 0) {
				let missingTask = itemData[b].filter(item => Number(item.id) > c.lvl && Number(item.id) <= currTask.level && item.TH <= currTH);
				missingTask = missingTask.map(item => ({ id: b, level: item.id, duration: item.duration, priority: 2 }));
				const resp1 = objToArray(missingTask, c.cnt || c.gear_up, char);
				char = resp1.char;
				tasks.push(...resp1.arr);
			}
		}
	}

	return { tasks };


	// for (const i of dataJSON) {
	// 	itemData = { ...itemData, ...loadJSON(i) };
	// }
	// const full = path.resolve(THJSON);
	// const raw = fs.readFileSync(full, "utf-8");
	// const thData = JSON.parse(raw);
	// const thData = thConfig;
	// const tasks = [];

	// const nextQty = arrayToObject(thData[nextTH]);
	// const currQty = arrayToObject(thData[currTH]);
	// let difference = {};
	// for (let key in nextQty) {
	// 	const nextval = nextQty[key];
	// 	const currval = currQty[key] || 0;
	// 	const diff = nextval - currval;

	// 	if (diff !== 0) {
	// 		difference[key] = diff;
	// 	}
	// }

	// for (const [key, value] of Object.entries(nextQty)) {
	// 	if (key === "Walls") continue; // skip walls
	// 	const build = itemData[key];
	// 	if (!build) {
	// 		console.warn(`Warning: No build data for ${key}`);
	// 		continue;
	// 	}
	// 	let char = 65
	// 	// New Buildings
	// 	if (difference[key] !== 0) {

	// 		const filter = build.filter(item => item.TH > 0 && item.TH <= nextTH);
	// 		if (filter.length === 0) {
	// 			console.warn(`Warning: No upgrade data for ${key} from TH${currTH} to TH${nextTH}`);
	// 			continue;
	// 		}
	// 		const task = filter.map(item => ({ id: key, level: item.id, duration: item.duration }));
	// 		const qty = difference[key] || 0;
	// 		let resp = objToArray(task, qty, char);
	// 		tasks.push(...resp.arr);
	// 		char = resp.char
	// 	}

	// 	//Existing Buildings
	// 	const filter1 = build.filter(item => item.TH > currTH && item.TH <= nextTH);
	// 	if (filter1.length === 0) {
	// 		console.warn(`Warning: No upgrade data for ${key} from TH${currTH} to TH${nextTH}`);
	// 		continue;
	// 	}
	// 	const task1 = filter1.map(item => ({ id: key, level: item.id, duration: item.duration }));
	// 	let qty1 = value
	// 	if (difference[key]) {
	// 		qty1 -= difference[key]
	// 	}
	// 	let resp1 = objToArray(task1, qty1, char);

	// 	tasks.push(...resp1.arr);
	// }

	// return { tasks: tasks };
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
		priority: t.priority ?? 0, // default priority if missing
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

	// "Only after the deadline of the previous task":
	// for roots: 0, for others: Infinity until predecessor finishes
	const earliestStart = normalized.map((_, i) =>
		typeof predecessor[i] === "number" ? Infinity : 0
	);

	const released = new Set();
	for (let i = 0; i < normalized.length; i++) {
		if (earliestStart[i] === 0) released.add(i);
	}

	const running = [];
	const freeWorkers = Array.from({ length: numWorkers }, (_, w) => w);

	// Decision hierarchy:
	// 1) priority DESC
	// 2) iter ASC
	// 3) earliestStart ASC (deadline of previous in same iter)
	// 4) stable by _idx
	function pickReadyTasks(currentTime) {
		const ready = [];
		for (const i of released) {
			if (earliestStart[i] <= currentTime) {
				ready.push(i);
			}
		}
		ready.sort((a, b) => {
			const pa = normalized[a].priority;
			const pb = normalized[b].priority;
			if (pa !== pb) return pa - pb; // higher priority first

			const ia = normalized[a].iter;
			const ib = normalized[b].iter;
			if (ia !== ib) return ia - ib; // lower iter first

			const ea = earliestStart[a];
			const eb = earliestStart[b];
			if (ea !== eb) return ea - eb; // earlier predecessor deadline first

			const da = normalized[a].duration, db = normalized[b].duration;
			if (da !== db) return da - db;           // 4) SPT among remaining ties

			return normalized[a]._idx - normalized[b]._idx; // stable
		});
		return ready;
	}

	const scheduled = new Array(normalized.length).fill(false);
	const result = [];
	let time = 0;
	let regenerateScheduleing = normalized.length;

	while (regenerateScheduleing > 0) {
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

			result.push({
				id: normalized[idx].id,
				level: normalized[idx].level,
				iter: normalized[idx].iter,
				priority: normalized[idx].priority,
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

		// Release successors after predecessor's deadline/finish
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

	const normalized = tasks.map((t, idx) => ({
		...t,
		_idx: idx,
		level: typeof t.level === "string" ? parseInt(t.level, 10) : t.level,
		priority: t.priority ?? 0, // default priority if missing
	}));

	// Build predecessor/successor by (id, iter, level)
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

	// Earliest start = 0 for roots, Infinity until predecessor finishes otherwise
	const earliestStart = normalized.map((_, i) =>
		typeof predecessor[i] === "number" ? Infinity : 0
	);

	const released = new Set();
	for (let i = 0; i < normalized.length; i++) {
		if (earliestStart[i] === 0) released.add(i);
	}

	const running = [];
	const freeWorkers = Array.from({ length: numWorkers }, (_, w) => w);

	// Decision hierarchy among *ready* tasks:
	// 1) priority DESC
	// 2) duration DESC (LPT)
	// 3) earliestStart ASC (earlier predecessor deadline first)  [tiebreak]
	// 4) iter ASC                                                [tiebreak]
	// 5) _idx ASC                                                [stable]
	function pickReadyTasks(currentTime) {
		const ready = [];
		for (const i of released) {
			if (earliestStart[i] <= currentTime) ready.push(i);
		}
		ready.sort((a, b) => {
			const pa = normalized[a].priority, pb = normalized[b].priority;
			if (pa !== pb) return pa - pb;

			const da = normalized[a].duration, db = normalized[b].duration;
			if (da !== db) return db - da;

			const ea = earliestStart[a], eb = earliestStart[b];
			if (ea !== eb) return ea - eb;

			const ia = normalized[a].iter, ib = normalized[b].iter;
			if (ia !== ib) return ia - ib;

			return normalized[a]._idx - normalized[b]._idx;
		});
		return ready;
	}

	const result = [];
	let time = 0;
	let remaining = normalized.length;

	while (remaining > 0) {
		// Assign ready tasks to available workers
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
				priority: normalized[idx].priority,
				duration: normalized[idx].duration,
				worker: w,
				start,
				end,
			});
		}

		if (remaining === 0) break;

		if (running.length === 0) {
			// No task can start now; jump to the next release time
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

		// Advance to next finishing task
		running.sort((a, b) => a.end - b.end);
		const next = running.shift();
		time = next.end;
		freeWorkers.push(next.worker);
		remaining--;

		// Release successors: they become schedulable right after predecessor finishes
		for (const succ of successors[next.idx]) {
			if (earliestStart[succ] === Infinity) {
				earliestStart[succ] = time;
				released.add(succ);
			}
		}
	}

	result.sort((a, b) => (a.start - b.start) || (a.worker - b.worker));
	let makespan = result.reduce((m, r) => Math.max(m, r.end), 0);
	makespan = formatTime(makespan); // keep consistent with your SPT formatter
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

// function isValidJSON(str) {
// 	try {
// 		const dataJSON = JSON.parse(str);
// 		return dataJSON;
// 	} catch (e) {
// 		console.error("Invalid JSON:", e);
// 		return false;
// 	}
// }


export function generateSchedule(dataJSON, builders, scheme = 'LPT') {

	if (!dataJSON || !dataJSON.buildings || dataJSON.buildings?.length === 0) {
		let resp = { schedule: [], makespan: 0 };
		return { sch: resp, valid: false }
	}

	const { tasks } = constructTasks(dataJSON, 5);

	const schedule = scheduleSPT(tasks, builders);
	// console.log("\n=== SPT with Precedence Constraints ===");

	for (const t of schedule.schedule) {
		t.start_iso = toISOString(t.start);
		t.end_iso = toISOString(t.end);
		t.duration_iso = toISOString(t.duration);
	}

	// console.log(`\nTotal project time (makespan): ${schedule.makespan}`);
	// printSchedule(schedule.schedule);

	const schedule2 = scheduleLPT(tasks, builders);
	// console.log("\n=== LPT with Precedence Constraints ===");

	for (const t of schedule2.schedule) {
		t.start_iso = toISOString(t.start);
		t.end_iso = toISOString(t.end);
		t.duration_iso = toISOString(t.duration);
	}

	// console.log(`\nTotal project time (makespan): ${schedule2.makespan}`);
	// printSchedule(schedule2.schedule);

	const resp = scheme === 'LPT' ? schedule2 : schedule;

	return { sch: resp, valid: true }

}

// generateSchedule(5);