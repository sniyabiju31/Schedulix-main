/**
 * FlexiblePlanner.js
 * 
 * Advanced backtracking generator for academic timetables.
 * Automatically handles faculty overlaps, lab blocks, and elective slots.
 */

export class FlexiblePlanner {
  constructor(allSchedules) {
    this.allData = allSchedules || [];
    this.days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    this.periods = [1, 2, 3, 4, 5, 6, 7];
    this.facultyBusyMap = {};
    this.facultyDailyWorkload = {};
    this.facultyWeeklyWorkload = {};
  }

  groupByDeptSem() {
    const groups = {};
    this.allData.forEach(item => {
      const dept = this.getValue(item, ['Department', 'Dept', 'Branch']) || 'UNKNOWN';
      const sem = this.getValue(item, ['Semester', 'Sem', 'SEM', 'SEMESTER', 'Year']) || 'UNKNOWN';
      const div = this.getValue(item, ['Division', 'Section', 'Div']) || 'A';
      const rawKey = `${dept}-${sem}-${div}`.toUpperCase();
      // Sanitize key for Firebase (forbidden: . # $ [ ] /)
      const groupKey = rawKey.replace(/[.#$[\]/]/g, '_');

      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
    });
    return groups;
  }

  generate() {
    const groups = this.groupByDeptSem();
    const groupKeys = Object.keys(groups).sort();
    const allResults = {};

    this.facultyBusyMap = {};
    this.facultyDailyWorkload = {};
    this.facultyWeeklyWorkload = {};

    groupKeys.forEach(key => {
      const subjects = groups[key];

      const timetable = {};
      this.days.forEach(day => {
        timetable[day] = {};
        this.periods.forEach(p => { timetable[day][p] = null; });
      });

      const tasks = this.prepareTasks(subjects);
      const conflicts = [];

      const units = [];
      tasks.forEach(task => {
        if (task.isLab) {
          for (let i = 0; i < task.remaining; i++) {
            units.push({ ...task, unitType: 'lab' });
          }
        } else {
          for (let i = 0; i < task.remaining; i++) {
            units.push({ ...task, unitType: 'theory' });
          }
        }
      });

      // Sort: labs first, then core, then minor
      units.sort((a, b) => (b.unitType === 'lab' ? 1 : 0) - (a.unitType === 'lab' ? 1 : 0) || (b.isCore ? 1 : 0) - (a.isCore ? 1 : 0) || (b.isMinor ? 1 : 0) - (a.isMinor ? 1 : 0));

      this.backtrackIterations = 0;
      this.maxPlaced = -1;
      this.bestTimetableState = null;
      this.searchStartTime = Date.now();
      const searchTimeout = 20000; 

      const success = this.solveBacktracking(timetable, units, 0, searchTimeout);

      if (!success && this.bestTimetableState) {
        this.restoreBestState(timetable);
        conflicts.push(`Backtracking limits reached. Partial schedule: ${this.maxPlaced}/${units.length}.`);

        tasks.forEach(t => t.remaining = t.credits);
        this.days.forEach(day => {
          this.periods.forEach(p => {
            const slot = timetable[day][p];
            if (slot && !slot.isLab) {
              const corr = tasks.find(tsk => tsk.name === slot.name);
              if (corr) corr.remaining--;
            }
          });
        });
        tasks.forEach(t => {
          if (t.isLab) {
            let blocksPlaced = 0;
            const seenBlocks = new Set();
            this.days.forEach(day => {
              this.periods.forEach(p => {
                const s = timetable[day][p];
                if (s && s.name === t.name && s.blockRange) {
                  const blockId = `${day}-${s.blockRange}`;
                  if (!seenBlocks.has(blockId)) {
                    blocksPlaced++;
                    seenBlocks.add(blockId);
                  }
                }
              });
            });
            t.remaining = Math.max(0, t.credits - blocksPlaced);
          }
          if (t.remaining > 0) conflicts.push(`Missing periods for ${t.name}`);
        });
      } else {
        tasks.forEach(t => t.remaining = 0);
      }

      allResults[key] = {
        timetable,
        conflicts,
        summary: this.generateSummary(timetable),
        allocation: tasks.map(t => ({
          name: t.name,
          allocated: t.remaining === 0,
          remaining: t.remaining
        }))
      };
    });

    return allResults;
  }

  getValue(row, keys) {
    if (!row) return "";
    const matchedKey = Object.keys(row).find(k =>
      keys.some(pk => String(k).toLowerCase().trim() === String(pk).toLowerCase().trim())
    );
    return matchedKey ? String(row[matchedKey]) : "";
  }

  prepareTasks(subjects) {
    const mergedSubjects = {};
    subjects.forEach(s => {
      const category = (this.getValue(s, ['Category', 'Type']) || '').toLowerCase();
      if (category.includes('minors h') || category.includes('5minors')) return;

      let name = this.getValue(s, ['Subject', 'Name', 'Course', 'Title']);
      if (!name || name === 'undefined') name = 'Unknown Subject';

      const isSlotCategory = category.includes('elective') || category.includes('minor') || category.includes('honour') || category.includes('honor');
      const catSlotMatch = category.match(/(\d+)\s*(?:elective|minor|honour|honor)/i) || category.match(/(?:.*?\s+)?(?:elective|minor|honour|honor)[\s-]*([ivx\d]+)/i);
      const nameSlotMatch = name.match(/\((?:PROGRAM\s+)?ELECTIVE[\s-]*([ivx\d]+)\)/i);
      
      const slotNum = (nameSlotMatch ? nameSlotMatch[1] : (catSlotMatch ? (catSlotMatch[1] || catSlotMatch[2]) : null));
      const slotKey = slotNum ? `SLOT-${slotNum.toUpperCase()}` : null;
      const isElectiveSlot = isSlotCategory && !!slotKey;
      const normKey = slotKey || name.toLowerCase().trim();

      let credits = parseInt(this.getValue(s, ['Credit', 'Credits', 'AH', 'Hours']));
      if (isNaN(credits) || credits <= 0) credits = 1;

      const isLab = category.includes('lab') || category.includes('practical') || category.includes('workshop') || category.includes('project');
      const isProject = category.includes('project') || name.toLowerCase().includes('project');
      const sem = this.getValue(s, ['Semester', 'Sem', 'SEM', 'SEMESTER', 'Year']) || 'UNKNOWN';
      const isS8 = sem.toString().toUpperCase().includes('8');

      const sessionCount = (isLab && isProject && isS8) ? Math.ceil(credits / 3) : 1;
      const isCore = category.includes('core') || category.includes('honour') || category.includes('honor');
      const isMinor = category.includes('minor') || name.toLowerCase().includes('minor') || category.includes('elective') || isElectiveSlot;

      let faculty = (this.getValue(s, ['Faculty', 'Teacher', 'Instructor']) || '').trim();
      if (!faculty || faculty === 'undefined') faculty = 'Unassigned';

      if (!mergedSubjects[normKey]) {
        mergedSubjects[normKey] = {
          id: s.id || Math.random().toString(),
          name: slotKey ? `Elective ${slotNum.toUpperCase()} (${name})` : name,
          baseName: slotKey ? `Elective ${slotNum.toUpperCase()}` : name,
          subjects: slotKey ? [name] : [],
          facultySet: new Set([faculty]),
          isLab,
          isProject,
          isCore,
          isMinor,
          credits: isLab ? sessionCount : credits,
          isSlot: !!slotKey
        };
      } else {
        const ms = mergedSubjects[normKey];
        ms.facultySet.add(faculty);
        ms.credits = Math.max(ms.credits, isLab ? sessionCount : credits);
        if (ms.isSlot && ms.subjects && !ms.subjects.includes(name)) {
          ms.subjects.push(name);
          ms.name = `${ms.baseName} (${ms.subjects.join(' / ')})`;
        }
      }
    });

    const tasks = [];
    Object.values(mergedSubjects).forEach(ms => {
      const faculties = Array.from(ms.facultySet).filter(f => f !== 'Unassigned' && f !== '');
      const facultyStr = faculties.length > 0 ? faculties.join(' & ') : 'Unassigned';
      tasks.push({
        id: ms.id,
        name: ms.name,
        faculty: facultyStr,
        facultyList: faculties,
        isLab: ms.isLab,
        isCore: ms.isCore,
        isMinor: ms.isMinor,
        credits: ms.credits,
        isProject: ms.isProject,
        remaining: ms.credits
      });
    });

    return tasks.sort((a, b) => (b.isLab ? 1 : 0) - (a.isLab ? 1 : 0) || (b.isCore ? 1 : 0) - (a.isCore ? 1 : 0) || (b.isMinor ? 1 : 0) - (a.isMinor ? 1 : 0) || b.credits - a.credits);
  }

  solveBacktracking(timetable, units, index, searchTimeout) {
    this.backtrackIterations++;
    if (this.backtrackIterations % 1000 === 0) {
      if (Date.now() - this.searchStartTime > searchTimeout) return false;
    }
    if (this.backtrackIterations > 500000) return false;

    if (index > this.maxPlaced) {
      this.maxPlaced = index;
      this.saveBestState(timetable);
    }

    if (index >= units.length) return true;
    const unit = units[index];

    if (unit.unitType === 'lab') {
      const blocks = [{ start: 5, end: 7 }, { start: 2, end: 4 }];
      for (const block of blocks) {
        for (const day of this.days) {
          const hasLabToday = Object.values(timetable[day]).some(slot => slot && slot.isLab);
          if (hasLabToday) continue;
          if (this.canPlaceBlock(timetable, day, block, unit)) {
            this.occupyBlock(timetable, day, block, unit);
            if (this.solveBacktracking(timetable, units, index + 1, searchTimeout)) return true;
            this.freeBlock(timetable, day, block, unit);
          }
        }
      }
      for (const block of blocks) {
        for (const day of this.days) {
          if (this.canPlaceBlock(timetable, day, block, unit)) {
            const hasLabToday = Object.values(timetable[day]).some(slot => slot && slot.isLab);
            if (!hasLabToday) continue;
            this.occupyBlock(timetable, day, block, unit);
            if (this.solveBacktracking(timetable, units, index + 1, searchTimeout)) return true;
            this.freeBlock(timetable, day, block, unit);
          }
        }
      }
    } else {
      const preferredPeriods = unit.isCore ? [1, 2, 3, 4, 5, 6, 7] : [5, 6, 7, 1, 2, 3, 4];
      const candidates = [];
      for (const day of this.days) {
        for (const p of preferredPeriods) {
          if (this.canPlaceTheory(timetable, unit, day, p)) {
            const repeats = this.isRepeatingPeriod(timetable, unit.name, p) ? 1 : 0;
            const consec = this.isConsecutive(timetable, unit.name, day, p) ? 1 : 0;
            const score = (repeats * 10) + (consec * 5) + (preferredPeriods.indexOf(p));
            candidates.push({ day, p, score });
          }
        }
      }
      candidates.sort((a, b) => a.score - b.score);
      for (const cand of candidates) {
        this.occupyTheory(timetable, unit, cand.day, cand.p);
        if (this.solveBacktracking(timetable, units, index + 1, searchTimeout)) return true;
        this.freeTheory(timetable, unit, cand.day, cand.p);
      }
    }
    return false;
  }

  saveBestState(timetable) {
    this.bestTimetableState = JSON.parse(JSON.stringify(timetable));
    this.bestFacultyBusyMap = { ...this.facultyBusyMap };
    this.bestFacultyDailyWorkload = { ...this.facultyDailyWorkload };
    this.bestFacultyWeeklyWorkload = { ...this.facultyWeeklyWorkload };
  }

  restoreBestState(timetable) {
    if (!this.bestTimetableState) return;
    Object.keys(this.bestTimetableState).forEach(day => {
      timetable[day] = this.bestTimetableState[day];
    });
    this.facultyBusyMap = this.bestFacultyBusyMap;
    this.facultyDailyWorkload = this.bestFacultyDailyWorkload;
    this.facultyWeeklyWorkload = this.bestFacultyWeeklyWorkload;
  }

  canPlaceTheory(timetable, task, day, p) {
    if (timetable[day][p] !== null) return false;
    let sessionsToday = 0;
    Object.values(timetable[day]).forEach(slot => { if (slot && slot.name === task.name) sessionsToday++; });
    if (sessionsToday >= 2) return false;
    if (!this.isFacultyAvailable(task.facultyList, day, p, 1, task.name)) return false;
    return true;
  }

  isRepeatingPeriod(timetable, taskName, p) {
    for (const day of this.days) { if (timetable[day][p] && timetable[day][p].name === taskName) return true; }
    return false;
  }

  isConsecutive(timetable, taskName, day, p) {
    const prev = timetable[day][p - 1];
    const next = timetable[day][p + 1];
    return (prev && prev.name === taskName) || (next && next.name === taskName);
  }

  occupyTheory(timetable, task, day, p) {
    let isShared = false;
    if (task.facultyList && task.facultyList.length > 0) {
      const entry = this.facultyBusyMap[`${task.facultyList[0]}-${day}-${p}`];
      if (entry && entry.taskName === task.name) isShared = true;
    }
    timetable[day][p] = { ...task, isSharedInstance: isShared };
    this.markFacultyBusy(task.facultyList, day, p, task.name);
    if (!isShared) this.addFacultyWorkload(task.facultyList, day, 1);
  }

  freeTheory(timetable, task, day, p) {
    const isShared = timetable[day][p].isSharedInstance;
    timetable[day][p] = null;
    this.unmarkFacultyBusy(task.facultyList, day, p, task.name);
    if (!isShared) this.removeFacultyWorkload(task.facultyList, day, 1);
  }

  canPlaceBlock(timetable, day, block, task) {
    const workloadToAdd = 1;
    let isShared = false;
    if (task.facultyList && task.facultyList.length > 0) {
      const entry = this.facultyBusyMap[`${task.facultyList[0]}-${day}-${block.start}`];
      if (entry && entry.taskName === task.name) isShared = true;
    }
    for (let p = block.start; p <= block.end; p++) {
      if (timetable[day][p] !== null) return false;
      if (!this.isFacultyAvailable(task.facultyList, day, p, 0, task.name)) return false;
    }
    return true;
  }

  occupyBlock(timetable, day, block, task) {
    let isShared = false;
    if (task.facultyList && task.facultyList.length > 0) {
      const entry = this.facultyBusyMap[`${task.facultyList[0]}-${day}-${block.start}`];
      if (entry && entry.taskName === task.name) isShared = true;
    }
    for (let p = block.start; p <= block.end; p++) {
      timetable[day][p] = { ...task, blockRange: `${block.start}-${block.end}`, isSharedInstance: isShared };
      this.markFacultyBusy(task.facultyList, day, p, task.name);
    }
    if (!isShared) this.addFacultyWorkload(task.facultyList, day, 1);
  }

  freeBlock(timetable, day, block, task) {
    const isShared = timetable[day][block.start].isSharedInstance;
    for (let p = block.start; p <= block.end; p++) {
      timetable[day][p] = null;
      this.unmarkFacultyBusy(task.facultyList, day, p, task.name);
    }
    if (!isShared) this.removeFacultyWorkload(task.facultyList, day, 1);
  }

  isFacultyAvailable(facultyList, day, p, checkWorkloadDuration = 0, taskName) {
    if (!facultyList || facultyList.length === 0) return true;
    for (const name of facultyList) {
      const entry = this.facultyBusyMap[`${name}-${day}-${p}`];
      if (entry !== undefined && entry.taskName !== taskName) return false;
    }
    return true;
  }

  markFacultyBusy(facultyList, day, p, taskName) {
    if (!facultyList || facultyList.length === 0) return;
    for (const name of facultyList) {
      const key = `${name}-${day}-${p}`;
      const entry = this.facultyBusyMap[key];
      if (!entry) this.facultyBusyMap[key] = { taskName: taskName || 'Unnamed', count: 1 };
      else if (entry.taskName === taskName) entry.count++;
    }
  }

  addFacultyWorkload(facultyList, day, amount) {
    if (!facultyList || facultyList.length === 0) return;
    for (const name of facultyList) {
      this.facultyDailyWorkload[`${name}-${day}`] = (this.facultyDailyWorkload[`${name}-${day}`] || 0) + amount;
      this.facultyWeeklyWorkload[name] = (this.facultyWeeklyWorkload[name] || 0) + amount;
    }
  }

  unmarkFacultyBusy(facultyList, day, p, taskName) {
    if (!facultyList || facultyList.length === 0) return;
    for (const name of facultyList) {
      const key = `${name}-${day}-${p}`;
      const entry = this.facultyBusyMap[key];
      if (entry && entry.taskName === taskName) {
        entry.count--;
        if (entry.count <= 0) delete this.facultyBusyMap[key];
      }
    }
  }

  removeFacultyWorkload(facultyList, day, amount) {
    if (!facultyList || facultyList.length === 0) return;
    for (const name of facultyList) {
      this.facultyDailyWorkload[`${name}-${day}`] = Math.max(0, (this.facultyDailyWorkload[`${name}-${day}`] || 0) - amount);
      this.facultyWeeklyWorkload[name] = Math.max(0, (this.facultyWeeklyWorkload[name] || 0) - amount);
    }
  }

  generateSummary(timetable) {
    const labs = [];
    const seen = new Set();
    this.days.forEach(day => {
      this.periods.forEach(p => {
        const item = timetable[day][p];
        if (item?.isLab) {
          const blockId = `${day}-${item.name}-${item.blockRange || p}`;
          if (!seen.has(blockId)) {
            labs.push({ day, subject: item.name, block: item.blockRange ? `P${item.blockRange}` : `P${p}`, faculty: item.faculty });
            seen.add(blockId);
          }
        }
      });
    });
    return labs;
  }
}
