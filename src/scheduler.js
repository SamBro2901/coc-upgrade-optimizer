import defenseConfig from './data/defenses.json' with { type: "json" };
import trapConfig from './data/traps.json' with { type: "json" };
import resConfig from './data/resources.json' with { type: "json" };
import armyConfig from './data/army.json' with { type: "json" };
import thConfig from './data/th.json' with { type: "json" };
import bhConfig from './data/bh.json' with { type: "json" };
import heroConfig from './data/heroes.json' with { type: "json" }
import mapping from './data/mapping.json' with { type: "json" };

import priority from './data/priority.json' with { type: "json" }

// eslint-disable-next-line no-unused-vars
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
		finalSeconds = Math.ceil(reducedTime);
	} else if (durationSeconds <= oneDay) {
		const tenMinutes = 10 * 60;
		finalSeconds = Math.floor(reducedTime / tenMinutes) * tenMinutes;
	} else {
		const oneHour = 60 * 60;
		finalSeconds = Math.floor(reducedTime / oneHour) * oneHour;
	}

	return finalSeconds;
}

function constructTasks(inputData, scheme = "LPT", priori = false, base = "home", builderBoost = 0) {
	let itemData = { ...defenseConfig, ...trapConfig, ...resConfig, ...armyConfig };

	let pData = [], hData = [];

	if (base === "home") {
		// Home Village
		pData = [...inputData.buildings];
		if (inputData.traps) pData.push(...inputData.traps);
		hData = inputData.heroes;
	} else {
		// Builder Base
		pData = [...inputData.buildings2];
		if (inputData.traps2) pData.push(...inputData.traps2);
		hData = inputData.heroes2;
	}


	let buildData = [], buildings = [], heroes = [], heroData = [], tasks = [];
	for (let item of pData) {
		if (mapping[item.data] === undefined) {
			console.log('Missing mapping', item.data);
			continue;
		}
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

	let currTH = 1, numWorkers = 2;
	if (base === "home") {
		// Home Village
		currTH = buildData.find(b => b.name === 'Town_Hall').lvl;
		numWorkers = buildData.filter(b => b.name === 'Builders_Hut').reduce((sum, v) => sum + (v.timer ? 1 : v.cnt || v.gear_up), 0);
		let BOB = buildData.filter(b => b.name === 'B.O.B_Hut')?.reduce((sum, v) => sum + (v.timer ? 1 : v.cnt || v.gear_up), 0);
		BOB = BOB ? BOB : 0;
		numWorkers += BOB;
		buildData = buildData.filter(b => b.name !== 'Town_Hall');
	}
	else {
		// Builder Base
		currTH = buildData.find(b => b.name === "Builder_Hall").lvl;
		numWorkers = 1
		const OTTO = buildData.find(b => b.name === "O.T.T.O_Outpost");
		numWorkers = OTTO ? numWorkers + 1 : numWorkers;
		buildData = buildData.filter(b => b.name !== "Builder_Hall");
	}

	const maxBuilds = base === "home" ? arrayToObject(thConfig[currTH]) : arrayToObject(bhConfig[currTH]);

	for (let b of buildings) {
		if (b === "Wall") continue;
		if (!itemData[b]) continue;
		let currBuild = buildData.filter(i => i.name === b);
		let currCount = 0, char = 1;
		if (currBuild.length !== 0) {
			currCount = currBuild.reduce((sum, v) => sum + (v.timer ? 1 : v.cnt || v.gear_up || 1), 0);
		}

		// Missing Buildings
		if (currCount < maxBuilds[b]) {
			let task = itemData[b].filter(item => item.TH > 0 && item.TH <= currTH).map(item => ({ id: b, level: item.level, duration: applyBoost(item.duration, builderBoost), priority: priority[b] && priori ? priority[b] : 100 })); // Immediate priority to build
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
				missingTask = missingTask.map(item => ({ id: b, level: item.level, duration: applyBoost(item.duration, builderBoost), priority: priority[b] && priori ? priority[b] : 100 }));
				const resp1 = objToArray(missingTask, (c.timer ? 1 : c.cnt || c.gear_up || 1), char);
				char = resp1.char;
				tasks.push(...resp1.arr);
			}
			else {
				char++;
			}
		}
	}

	if (base === "home") {
		for (let h of heroes) {
			const maxHeroHall = itemData['Hero_Hall'].filter(i => i.TH <= currTH)?.sort((a, b) => b.level - a.level).map(item => ({ id: 'Hero_Hall', level: item.level, duration: applyBoost(item.duration, builderBoost) }))[0] || 0;
			let currHero = heroData.find(he => he.name === h);

			if (currHero.timer) {
				currHero.lvl += 1;
				tasks.push({ id: h, level: currHero.lvl, duration: currHero.timer, priority: 1, iter: 1 })
			}
			let missingHLvls = heroConfig[h].filter(i => i.HH <= maxHeroHall.level && i.level > currHero.lvl);
			missingHLvls = missingHLvls.map(he => ({ id: h, level: he.level, duration: applyBoost(he.duration, builderBoost), HH: he.HH, priority: priority[h] && priori ? priority[h] : 100, iter: 1 }));

			tasks.push(...missingHLvls)
		}
	}

	tasks = lockPredecessors(inputData, tasks);

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

function lockPredecessors(playerData, tasks) {
	const heroes = ['Barbarian_King', 'Archer_Queen', 'Minion_Prince', 'Grand_Warden', 'Royal_Champion'];

	tasks = tasks.map((t, idx) => ({ ...t, index: idx, worker: null, pred: [], key: `${t.id}_${t.iter}_${t.level}` }));

	// Lock to predecessor - Buildings
	for (const t of tasks) {
		const pred = tasks.find(pt => pt.key === `${t.id}_${t.iter}_${t.level - 1}`);
		if (pred) t.pred.push(pred.index);
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
				tasks[hero.index].pred.push(tasks[reqIdx].index)
			}
		}
	}

	return tasks;
}

function getTimeString(epoch) {
	const date = new Date(epoch * 1000); // convert to ms

	const hh = String(date.getHours()).padStart(2, "0");
	const mm = String(date.getMinutes()).padStart(2, "0");

	const timeString = `${hh}:${mm}`;
	return timeString
}

function setDateString(epoch, target) {
	const targetSplit = target.split(":");
	const date = new Date(epoch * 1000);
	const targetDate = new Date(date);

	targetDate.setHours(targetSplit[0], targetSplit[1], 0, 0);

	if (targetDate.getTime() <= date.getTime()) {
		targetDate.setDate(targetDate.getDate() + 1);
	}

	return Math.floor(targetDate.getTime() / 1000);
}

function myScheduler(tasks, numWorkers = 3, scheme = 'LPT', activeStart = "08:00", activeEnd = "23:59", optimize = false) {
	// console.log(tasks.filter(t => heroes.includes(t.id)));
	// console.log(hhTask);
	// return;
	const taskLength = tasks.length;
	let iterations = 0;

	let ready = tasks.filter(t => t.pred.length === 0);
	let notReady = tasks.filter(t => t.pred.length !== 0);
	let running = [], completed = [];

	let workers = Array.from({ length: numWorkers }, () => null); // null means idle

	ready = sortTasks(ready, scheme)

	let currTime = Math.floor(Date.now() / 1000);
	const startTime = currTime;

	while (ready.length > 0 || completed.length !== taskLength || notReady.length > 0) {
		if (iterations > 100000) throw new Error("Loop overflow");
		// console.log(`Total Tasks: ${taskLength}, Ready Tasks: ${ready.length}, Not Ready Tasks: ${notReady.length}, Running Tasks: ${running.length}, Completed Tasks: ${completed.length}`);
		let idx = 0;
		const runningTasks = ready.filter(t => t.priority === 1 && t.pred.length === 0);
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

			const currTimeString = getTimeString(currTime);
			// Break out if current timestamp is during off-time
			if (currTimeString < activeStart || currTimeString > activeEnd) break;

			const currTask = ready[idx];
			const predTask = completed.find(t => t.key === `${currTask.id}_${currTask.iter}_${currTask.level - 1}`);
			if (predTask && workers[predTask.worker] === null) w = predTask.worker;
			ready[idx].worker = w;
			ready[idx].start = currTime;
			ready[idx].end = currTime + ready[idx].duration;
			workers[w] = ready[idx];
			running.push(ready[idx]);
			ready.splice(idx, 1);

			const remIdx = freeWorkers.findIndex(fw => fw.index === w);
			freeWorkers.splice(remIdx, 1);
		}

		let finishedTime = currTime;
		if (running.length > 0) {
			finishedTime = Math.min(...running.map(wd => wd.end));
		}
		let finishTimeString = getTimeString(finishedTime);
		if (finishTimeString < activeStart || finishTimeString > activeEnd) finishedTime = setDateString(finishedTime, activeStart);
		currTime = finishedTime;
		const finishedTask = workers.filter(wd => wd?.end <= finishedTime);
		for (let ft of finishedTask) {
			completed.push(ft);
			workers[ft.worker] = null;
			running = running.filter(t => t.index !== ft.index);

			// Release successor tasks
			let succTask = notReady.filter(t => t.pred.includes(ft.index));
			if (succTask.length > 0) {
				for (const s of succTask) {
					const succIdx = notReady.findIndex(t => t.index === s.index);
					const predIdx = notReady[succIdx].pred.indexOf(ft.index);
					notReady[succIdx].pred.splice(predIdx, 1)
					if (notReady[succIdx].pred.length === 0) {
						ready.push(s);
						notReady.splice(succIdx, 1);
					}
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
	makespan = formatDuration(makespan - startTime);

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


function printSchedule(schedule, printbyWorker = false) {
	if (!Array.isArray(schedule) || schedule.length === 0) {
		console.log("No tasks scheduled.");
		return;
	}

	console.log("=== Task Schedule ===");
	console.log(
		"Worker |  Task ID      | Level | Iter | Duration | Start | End"
	);
	console.log("------- | ------------- | ----- | ---- | -------- | ----- | ---");

	if (printbyWorker) {
		schedule = schedule.sort((a, b) => a.worker - b.worker || a.start - b.start);

	}

	for (const t of schedule) {
		console.log(
			`${t.worker.toString().padEnd(6)} | ${t.id.padEnd(12)} | ${t.level
				.toString()
				.padEnd(5)} | ${t.iter} | ${t.duration_iso.padEnd(8)} | ${t.start_iso.padEnd(7)} | ${t.end_iso}`
		);
	}
}

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


export function generateSchedule(dataJSON, debug = false, scheme = 'LPT', priority = false, base = "home", boost = 0.05, startTime = "07:00", endTime = "23:00") {

	if (!dataJSON || !dataJSON.buildings || dataJSON.buildings?.length === 0) {
		let resp = { schedule: [], makespan: 0 };
		return { sch: resp, err: [true, "Failed to parse building data from JSON"] }
	}

	const { tasks, numWorkers } = constructTasks(dataJSON, scheme, priority, base, boost);

	const schedule = myScheduler(tasks, numWorkers, scheme, startTime, endTime, true);

	for (const t of schedule.schedule) {
		t.start_iso = toISOString(t.start);
		t.end_iso = toISOString(t.end);
		t.duration_iso = toISOString(t.duration);
	}

	if (debug) printSchedule(schedule.schedule)

	return { sch: schedule, numBuilders: numWorkers, err: [false] }

}

// generateSchedule(playerData, true, "LPT", 'builder');