import defenseConfig from './data/defenses.json' with { type: "json" };
import trapConfig from './data/traps.json' with { type: "json" };
import resConfig from './data/resources.json' with { type: "json" };
import armyConfig from './data/army.json' with { type: "json" };
import thConfig from './data/th.json' with { type: "json" };
import mapping from './data/mapping.json' with { type: "json" };

import playerData from './data/coc_data.json' with { type: "json" };

function arrayToObject(arr) {
	return arr.reduce((acc, item) => {
		const key = Object.keys(item)[0];
		acc[key] = item[key];
		return acc;
	}, {});
}

function objToArray(task, qty = 1, char = 65) {
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

function constructTasks(inputData) {
	let itemData = { ...defenseConfig, ...trapConfig, ...resConfig, ...armyConfig };

	let pData = inputData.buildings;
	let buildData = [], buildings = [], tasks = [];
	for (let item of pData) {
		if (mapping[item.data] === undefined) continue;
		if (!buildings.includes(mapping[item.data])) buildings.push(mapping[item.data])

		buildData.push({ ...item, name: mapping[item.data] });
	}

	const currTH = buildData.find(b => b.name === 'TownHall').lvl;
	const numWorkers = buildData.filter(b => b.name === 'BuilderHut').reduce((sum, v) => sum + (v.timer ? 1 : v.cnt || v.gear_up), 0);
	buildData = buildData.filter(b => b.name !== 'TownHall');
	const maxBuilds = arrayToObject(thConfig[currTH])

	for (let b of buildings) {
		let currBuild = buildData.filter(i => i.name === b);
		let currCount = 0, char = 65;
		if (currBuild.length !== 0) {
			currCount = currBuild.reduce((sum, v) => sum + (v.timer ? 1 : v.cnt || v.gear_up || 1), 0);
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
			// Currently upgrading buildings - Priority 1
			if (c.timer) {
				let task = { id: b, level: String(c.lvl), duration: c.timer, priority: 1, iter: String.fromCharCode(char) };
				tasks.push(task);
			}

			let currTask = itemData[b]?.filter(item => item.TH === currTH)?.sort((a, b) => b.id - a.id).map(item => ({ id: b, level: item.id, duration: item.duration }))[0];
			let missingLvls = currTask?.level - c.lvl || 0;
			if (missingLvls > 0) {
				let missingTask = itemData[b].filter(item => Number(item.id) > c.lvl && Number(item.id) <= currTask.level && item.TH <= currTH);
				missingTask = missingTask.map(item => ({ id: b, level: item.id, duration: item.duration, priority: 2 }));
				const resp1 = objToArray(missingTask, (c.timer ? 1 : c.cnt || c.gear_up || 1), char);
				char = resp1.char;
				tasks.push(...resp1.arr);
			}
		}
	}

	return { tasks, pData, numWorkers };
}

function myScheduler(playerData, tasks, numWorkers = 3, scheme = 'LPT') {

	console.log('here 1')
	tasks = tasks.map((t, idx) => ({ ...t, index: idx, worker: null, pred: null, key: `${t.id}_${t.iter}_${t.level}` }));
	const taskLength = tasks.length;

	for (const t of tasks) {
		const pred = tasks.find(pt => pt.key === `${t.id}_${t.iter}_${t.level - 1}`);
		if (pred) t.pred = pred.index;
	}

	let ready = tasks.filter(t => t.pred === null);
	let notReady = tasks.filter(t => t.pred !== null);
	let running = [], completed = [];

	let workers = Array.from({ length: numWorkers }, () => null); // null means idle

	switch (scheme) {
		case 'LPT':
			ready = ready.sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : b.duration - a.duration);
			break;
		case 'SPT':
			ready = ready.sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : a.duration - b.duration);
			break;
		default:
			throw new Error("Unknown scheduling scheme: " + scheme);
	}

	let currTime = 0
	while (ready.length > 0 || completed.length !== taskLength || notReady.length > 0) {
		// console.log(`Ready Tasks: ${ready.length}, Not Ready Tasks: ${notReady.length}, Running Tasks: ${running.length}, Completed Tasks: ${completed.length}`);
		let idx = 0;
		const runningTasks = ready.filter(t => t.priority === 1 && t.pred === null);

		for (let w = 0; w < numWorkers && ready.length > 0; w++) {
			if (workers[w] !== null) continue;

			// Prioritize running tasks (priority 1)
			if (runningTasks.length > 0) {
				const arrIdx = ready.findIndex(t => t.key === runningTasks[0].key);
				ready[arrIdx].worker = w;
				ready[arrIdx].start = currTime;
				ready[arrIdx].end = currTime + ready[arrIdx].duration;
				workers[w] = ready[arrIdx];
				running.push(ready[arrIdx]);
				runningTasks.shift();
				ready.splice(arrIdx, 1);
				continue;
			}

			if (ready[idx].pred !== null) {
				const pred = ready[idx].pred;
				const predTask = completed.find(t => t.index === pred);
				if (!predTask) idx++;
				else {
					if (workers[predTask.worker] === null) {
						w = predTask.worker;
					}
				}
			}

			ready[idx].worker = w;
			ready[idx].start = currTime;
			ready[idx].end = currTime + ready[idx].duration;
			workers[w] = ready[idx];
			running.push(ready[idx]);
			ready.splice(idx, 1);
		}

		const finishedTime = Math.min(...running.map(wd => wd.end));
		currTime = finishedTime;
		const finishedTask = workers.filter(wd => wd?.end === finishedTime);
		for (let ft of finishedTask) {
			completed.push(ft);
			workers[ft.worker] = null;
			running = running.filter(t => t.index !== ft.index);

			// Release successor tasks
			const succTask = notReady.find(t => t.pred === ft.index);
			if (succTask) {
				ready.push(succTask);
				notReady = notReady.filter(t => t.index !== succTask.index);
			}
		}
	}

	if (running.length > 0) {
		completed.push(...running);
		running = [];
	}


	completed.sort((a, b) => (a.start - b.start) || (a.worker - b.worker));
	let makespan = completed.reduce((m, r) => Math.max(m, r.end), 0);
	makespan = formatTime(makespan);

	return { schedule: completed, makespan };
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


export function generateSchedule(dataJSON, workers, scheme = 'LPT') {

	if (!dataJSON || !dataJSON.buildings || dataJSON.buildings?.length === 0) {
		let resp = { schedule: [], makespan: 0 };
		return { sch: resp, valid: false }
	}

	const { tasks, pData, numWorkers } = constructTasks(dataJSON, 5);

	const schedule = myScheduler(pData, tasks, numWorkers, scheme);

	// const schedule = scheduleSPT(pData, tasks, builders);
	// // console.log("\n=== SPT with Precedence Constraints ===");

	for (const t of schedule.schedule) {
		t.start_iso = toISOString(t.start);
		t.end_iso = toISOString(t.end);
		t.duration_iso = toISOString(t.duration);
	}

	// console.log(`\nMY SCHEDULE Total project time (makespan): ${schedule.makespan}`);
	// printSchedule(schedule.schedule);

	// const schedule2 = scheduleLPT(tasks, builders);
	// console.log("\n=== LPT with Precedence Constraints ===");

	// for (const t of schedule2.schedule) {
	// 	t.start_iso = toISOString(t.start);
	// 	t.end_iso = toISOString(t.end);
	// 	t.duration_iso = toISOString(t.duration);
	// }

	// console.log(`\nLPT Total project time (makespan): ${schedule2.makespan}`);
	// printSchedule(schedule2.schedule);

	// const resp = scheme === 'LPT' ? schedule2 : schedule;

	return { sch: schedule, valid: true }

}

// generateSchedule(playerData, 5);