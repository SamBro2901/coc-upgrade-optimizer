import defenseConfig from './data/defenses.json' with { type: "json" };
import trapConfig from './data/traps.json' with { type: "json" };
import resConfig from './data/resources.json' with { type: "json" };
import armyConfig from './data/army.json' with { type: "json" };
import thConfig from './data/th.json' with { type: "json" };
import heroConfig from './data/heroes.json' with { type: "json" }
import mapping from './data/mapping.json' with { type: "json" };

import priority from './data/priority.json' with { type: "json" }

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
			iter: char
		}));
		char++;
		return mark;
	}
	).flat();
	return { arr, char };
}

function applyBoost(durationSeconds, boost) {
	let reducedTime = durationSeconds * (1 - boost);

	const thirtyMinutes = 30 * 60;
	const oneDay = 24 * 60 * 60;

	let finalSeconds;

	if (durationSeconds < thirtyMinutes) {
		// Case 1: Less than 30 minutes
		finalSeconds = Math.ceil(reducedTime); // round up fractional seconds
	} else if (durationSeconds <= oneDay) {
		// Case 2: Between 30 minutes and 1 day
		const tenMinutes = 10 * 60;
		finalSeconds = Math.floor(reducedTime / tenMinutes) * tenMinutes;
	} else {
		// Case 3: More than 1 day
		const oneHour = 60 * 60;
		finalSeconds = Math.floor(reducedTime / oneHour) * oneHour;
	}

	return finalSeconds;
}

function constructTasks(inputData, builderBoost = 0) {
	let itemData = { ...defenseConfig, ...trapConfig, ...resConfig, ...armyConfig };

	let pData = [...inputData.buildings];
	if (inputData.traps) pData.push(...inputData.traps);
	const hData = inputData.heroes;
	let buildData = [], buildings = [], heroes = [], heroData = [], tasks = [];
	for (let item of pData) {
		if (mapping[item.data] === undefined) continue;
		if (!buildings.includes(mapping[item.data])) buildings.push(mapping[item.data])

		buildData.push({ ...item, name: mapping[item.data] });
	}

	if (hData.length > 0) {
		for (let h of hData) {
			if (mapping[h.data] === undefined) continue;
			if (!heroes.includes(mapping[h.data])) heroes.push(mapping[h.data])

			heroData.push({ ...h, name: mapping[h.data] })
		}
	}

	const currTH = buildData.find(b => b.name === 'Town_Hall').lvl;
	const numWorkers = buildData.filter(b => b.name === 'Builders_Hut').reduce((sum, v) => sum + (v.timer ? 1 : v.cnt || v.gear_up), 0);
	buildData = buildData.filter(b => b.name !== 'Town_Hall');
	const maxBuilds = arrayToObject(thConfig[currTH])

	for (let b of buildings) {
		if (b === "Wall") continue;
		let currBuild = buildData.filter(i => i.name === b);
		let currCount = 0, char = 1;
		if (currBuild.length !== 0) {
			currCount = currBuild.reduce((sum, v) => sum + (v.timer ? 1 : v.cnt || v.gear_up || 1), 0);
		}

		// Missing Buildings
		if (currCount < maxBuilds[b]) {
			let task = itemData[b].filter(item => item.TH > 0 && item.TH <= currTH).map(item => ({ id: b, level: item.level, duration: applyBoost(item.duration, builderBoost), priority: priority[b] ? priority[b] : 100 })); // Immediate priority to build
			if (task.length > 1) { // Splice first task only
				let popTask = task.splice(0, 1)[0];
				popTask.priority = 2;
				popTask.iter = char
				tasks.push(popTask)
			}
			const resp = objToArray(task, maxBuilds[b] - currCount, char);
			char = resp.char;
			tasks.push(...resp.arr);
		}

		// Existing Buildings
		for (let c of currBuild) {
			// Currently upgrading buildings - Priority 1
			if (c.timer) {
				let task = { id: b, level: c.lvl + 1, duration: c.timer, priority: 1, iter: char };
				tasks.push(task);
				c.lvl += 1;
			}

			let currTask = itemData[b]?.filter(item => item.TH <= currTH)?.sort((a, b) => b.level - a.level).map(item => ({ id: b, level: item.level, duration: applyBoost(item.duration, builderBoost) }))[0];
			let missingLvls = currTask?.level - c.lvl || 0;
			if (missingLvls > 0) {
				let missingTask = itemData[b].filter(item => item.level > c.lvl && item.level <= currTask.level && item.TH <= currTH);
				missingTask = missingTask.map(item => ({ id: b, level: item.level, duration: applyBoost(item.duration, builderBoost), priority: priority[b] ? priority[b] : 100 }));
				const resp1 = objToArray(missingTask, (c.timer ? 1 : c.cnt || c.gear_up || 1), char);
				char = resp1.char;
				tasks.push(...resp1.arr);
			}
			else {
				char++;
			}
		}
	}

	for (let h of heroes) {
		const maxHeroHall = itemData['Hero_Hall'].filter(i => i.TH <= currTH)?.sort((a, b) => b.level - a.level).map(item => ({ id: 'Hero_Hall', level: item.level, duration: applyBoost(item.duration, builderBoost) }))[0] || 0;
		let currHero = heroData.find(he => he.name === h);

		if (currHero.timer) {
			currHero.lvl += 1;
			tasks.push({ id: h, level: currHero.lvl, duration: currHero.timer, priority: 1, iter: 1 })
		}
		let missingHLvls = heroConfig[h].filter(i => i.HH <= maxHeroHall.level && i.level > currHero.lvl);
		missingHLvls = missingHLvls.map(he => ({ id: h, level: he.level, duration: applyBoost(he.duration, builderBoost), HH: he.HH, priority: priority[h] ? priority[h] : 100, iter: 1 }));

		tasks.push(...missingHLvls)
	}

	return { tasks, numWorkers };
}

function sortTasks(arr, scheme) {
	switch (scheme) {
		case 'LPT':
			arr = arr.sort((a, b) => a.priority - b.priority || b.duration - a.duration);
			break;
		case 'SPT':
			arr = arr.sort((a, b) => a.priority - b.priority || a.duration - b.duration);
			break;
		default:
			return { sch: { schedule: [], makespan: 0 }, err: [true, `Unknown scheduling scheme provided: ${scheme}`] };
	}
	return arr;
}

function myScheduler(playerData, tasks, numWorkers = 3, scheme = 'LPT') {
	const heroes = ['Barbarian_King', 'Archer_Queen', 'Minion_Prince', 'Grand_Warden', 'Royal_Champion'];

	tasks = tasks.map((t, idx) => ({ ...t, index: idx, worker: null, pred: null, key: `${t.id}_${t.iter}_${t.level}` }));
	const taskLength = tasks.length;
	let iterations = 0;

	// Lock to predecessor - Buildings
	for (const t of tasks) {
		const pred = tasks.find(pt => pt.key === `${t.id}_${t.iter}_${t.level - 1}`);
		if (pred) t.pred = pred.index;
	}

	const heroTasks = tasks.filter(t => heroes.includes(t.id));
	const heroHall = playerData.buildings.find(b => b.data === 1000071); // Exisitng HH
	const hhTask = tasks.filter(t => t.id === "Hero_Hall"); // To construct HH
	// Lock to predecessor - Heroes
	if (heroTasks.length > 0) {
		let hhLvl = 0;
		if (heroHall) {
			hhLvl = heroHall.lvl;
		}
		for (const hero of heroTasks) {
			if (hero.priority === 1) continue;
			if (hero.HH > hhLvl) {
				const reqTask = hhTask.find(t => t.level === hero.HH);
				if (!reqTask) throw new Error("Missing Hero Hall Task");
				const reqIdx = tasks.findIndex(t => t.key === reqTask.key);
				// const heroIdx = tasks.findIndex(t => t.key === hero.key);
				tasks[hero.index].pred = tasks[reqIdx].index
			}
			else {
				const prevTask = heroTasks.find(ht => ht.level === hero.level - 1 && ht.id === hero.id);
				if (prevTask) tasks[hero.index].pred = prevTask.index;
			}

		}
	}

	let ready = tasks.filter(t => t.pred === null);
	let notReady = tasks.filter(t => t.pred !== null);
	let running = [], completed = [];

	let workers = Array.from({ length: numWorkers }, () => null); // null means idle

	ready = sortTasks(ready, scheme)

	let currTime = 0
	while (ready.length > 0 || completed.length !== taskLength || notReady.length > 0) {
		if (iterations > 100000) throw new Error("Loop overflow");
		// console.log(`Total Tasks: ${taskLength}, Ready Tasks: ${ready.length}, Not Ready Tasks: ${notReady.length}, Running Tasks: ${running.length}, Completed Tasks: ${completed.length}`);
		let idx = 0;
		const runningTasks = ready.filter(t => t.priority === 1 && t.pred === null);
		let freeWorkers = workers.map((w, idx) => ({ index: idx, value: w })).filter(w => w.value === null);

		while (freeWorkers.length > 0 && ready.length > 0) {
			let w = freeWorkers[0].index;
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

				const remIdx = freeWorkers.findIndex(fw => fw.index === w);
				freeWorkers.splice(remIdx, 1);
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

			const remIdx = freeWorkers.findIndex(fw => fw.index === w);
			freeWorkers.splice(remIdx, 1);
		}

		const finishedTime = Math.min(...running.map(wd => wd.end));
		currTime = finishedTime;
		const finishedTask = workers.filter(wd => wd?.end === finishedTime);
		for (let ft of finishedTask) {
			completed.push(ft);
			workers[ft.worker] = null;
			running = running.filter(t => t.index !== ft.index);

			// Release hero tasks after HH upgrade
			if (ft.id === "Hero_Hall") {
				const nextHeroes = tasks.filter(t => t.pred === ft.index);
				if (nextHeroes.length > 0) {
					for (const nH of nextHeroes) {
						const prevTask = tasks.find(ht => ht.level === nH.level - 1 && ht.id === nH.id);
						if (prevTask) {
							const heroIdx = notReady.findIndex(t => t.key === nH.key);
							notReady[heroIdx].pred = prevTask.index;
						}
					}
				}
			}

			// Release successor tasks
			const succTask = notReady.filter(t => t.pred === ft.index);
			if (succTask.length > 0) {
				for (const s of succTask) {
					ready.push(s);
					const remIdx = notReady.findIndex(t => t.index === s.index);
					notReady.splice(remIdx, 1);
				}
			}
		}
		ready = sortTasks(ready, scheme)
		iterations++
	}

	if (running.length > 0) {
		completed.push(...running);
		running = [];
	}


	completed.sort((a, b) => (a.start - b.start) || (a.worker - b.worker));
	let makespan = completed.reduce((m, r) => Math.max(m, r.end), 0);
	makespan = formatDuration(makespan);

	return { schedule: completed, makespan };
}

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

	return parts.length > 0 ? parts.join(" ") : "0s";
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


export function generateSchedule(dataJSON, scheme = 'LPT', boost = 0) {

	if (!dataJSON || !dataJSON.buildings || dataJSON.buildings?.length === 0) {
		let resp = { schedule: [], makespan: 0 };
		return { sch: resp, err: [true, "Failed to parse building data from JSON"] }
	}

	const { tasks, numWorkers } = constructTasks(dataJSON, boost);

	const schedule = myScheduler(dataJSON, tasks, numWorkers, scheme);

	for (const t of schedule.schedule) {
		t.start_iso = toISOString(t.start);
		t.end_iso = toISOString(t.end);
		t.duration_iso = toISOString(t.duration);
	}

	// printSchedule(schedule.schedule)

	return { sch: schedule, err: [false] }

}

generateSchedule(playerData, "LPT");