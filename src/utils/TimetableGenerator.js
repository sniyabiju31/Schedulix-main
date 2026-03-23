/**
 * TimetableGenerator.js
 * 
 * Core logic for automated timetable generation using constraint satisfaction (backtracking).
 */

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const HOURS = ["9:00-9:50", "9:50-10:40", "10:50-11:40", "11:40-12:30", "1:20-2:10", "2:20-3:10", "3:10-4:00"];

export class TimetableGenerator {
    constructor(subjects, teachers, preferences = [], existingTimetables = {}) {
        this.subjects = subjects; // Array of all subjects
        this.teachers = teachers; // Array of all teachers
        this.preferences = preferences; // Array of teacher preferences
        this.existingTimetables = existingTimetables; // structure: { Dept: { Sem: { Div: { Day: { Hour: Slot } } } } }

        this.timetables = {};
        this.teacherAvailability = {};
        this.teacherWorkLoad = {};
        this.debugInfo = [];
        this.steps = 0;
        this.MAX_STEPS = 50000;
    }

    log(msg) {
        if (this.debugInfo.length < 20) this.debugInfo.push(msg);
    }

    generate(divisions = ['A']) {
        this.initialize();
        const expandedSubjects = [];
        this.subjects.forEach(sub => {
            let divArray = divisions;
            if (!Array.isArray(divisions) && typeof divisions === 'object') {
                divArray = divisions[sub.semester] || ['A'];
            } else if (!Array.isArray(divisions)) {
                divArray = ['A'];
            }
            divArray.forEach(div => {
                expandedSubjects.push({ ...sub, division: div });
            });
        });

        const classes = this.groupSubjectsByClass(expandedSubjects);
        const classKeys = Object.keys(classes).sort((a, b) => {
            const semA = parseInt(a.split('-')[1].replace(/\D/g, '')) || 0;
            const semB = parseInt(b.split('-')[1].replace(/\D/g, '')) || 0;
            const isOddA = semA % 2 !== 0;
            const isOddB = semB % 2 !== 0;
            if (isOddA && !isOddB) return -1;
            if (!isOddA && isOddB) return 1;
            return 0;
        });

        for (const classKey of classKeys) {
            const classSubjects = classes[classKey];
            const sample = classSubjects[0];
            const { department: dept, semester: sem, division: div } = sample;

            if (!this.timetables[dept]) this.timetables[dept] = {};
            if (!this.timetables[dept][sem]) this.timetables[dept][sem] = {};
            if (!this.timetables[dept][sem][div]) this.timetables[dept][sem][div] = {};

            classSubjects.sort(() => Math.random() - 0.5);
            classSubjects.sort((a, b) => {
                const aIsLab = a.type === 'Lab' || a.credits > 3 || (a.teachingHours && a.teachingHours > 1);
                const bIsLab = b.type === 'Lab' || b.credits > 3 || (b.teachingHours && b.teachingHours > 1);
                if (aIsLab && !bIsLab) return -1;
                if (!aIsLab && bIsLab) return 1;
                return 0;
            });

            this.scheduleClass(dept, sem, div, classSubjects);
        }
        return this.timetables;
    }

    initialize() {
        this.timetables = {};
        this.teacherAvailability = {};
        this.teacherWorkLoad = {};

        this.teachers.forEach(t => {
            const tid = t.id || t.employeeId;
            this.teacherAvailability[tid] = {};
            this.teacherWorkLoad[tid] = { total: 0, daily: {} };
            DAYS.forEach(d => {
                this.teacherAvailability[tid][d] = {};
                this.teacherWorkLoad[tid].daily[d] = 0;
                HOURS.forEach(h => {
                    this.teacherAvailability[tid][d][h] = true;
                });
            });
        });

        if (this.existingTimetables) {
            Object.values(this.existingTimetables).forEach(deptObj => {
                Object.values(deptObj).forEach(semObj => {
                    Object.values(semObj).forEach(divObj => {
                        const processSchedule = (schedule) => {
                            if (!schedule) return;
                            Object.keys(schedule).forEach(day => {
                                if (DAYS.includes(day)) {
                                    const daySlots = schedule[day];
                                    Object.keys(daySlots).forEach(hour => {
                                        const slot = daySlots[hour];
                                        if (slot) {
                                            if (slot.isParallel && slot.parallelSlots) {
                                                slot.parallelSlots.forEach(ps => this.markBusy(ps.teacherId, day, hour));
                                            } else if (slot.multiTeachers) {
                                                slot.multiTeachers.forEach(t => this.markBusy(t.teacherId, day, hour));
                                            } else if (slot.teacherId) {
                                                this.markBusy(slot.teacherId, day, hour);
                                            }
                                        }
                                    });
                                }
                            });
                        };
                        const keys = Object.keys(divObj || {});
                        if (keys.some(k => DAYS.includes(k))) {
                            processSchedule(divObj);
                        } else {
                            Object.values(divObj).forEach(inner => processSchedule(inner));
                        }
                    });
                });
            });
        }
    }

    markBusy(tid, day, hour) {
        if (tid && this.teacherAvailability[tid]) {
            this.teacherAvailability[tid][day][hour] = false;
            if (this.teacherWorkLoad[tid]) {
                this.teacherWorkLoad[tid].total++;
                this.teacherWorkLoad[tid].daily[day]++;
            }
        }
    }

    groupSubjectsByClass(subjects) {
        const groups = {};
        subjects.forEach(sub => {
            const key = `${sub.department}-${sub.semester}-${sub.division}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(sub);
        });
        return groups;
    }

    scheduleClass(dept, sem, div, subjects) {
        this.steps = 0;
        const slotsToFill = [];
        const electiveGroups = {};
        const standaloneSubjects = [];

        subjects.forEach(sub => {
            if (sub.category && sub.category.startsWith("Elective")) {
                if (!electiveGroups[sub.category]) electiveGroups[sub.category] = [];
                electiveGroups[sub.category].push(sub);
            } else {
                standaloneSubjects.push(sub);
            }
        });

        standaloneSubjects.forEach(sub => {
            const hoursNeeded = parseInt(sub.teachingHours || sub.credits || 4);
            const isLab = sub.type === 'Lab' || (sub.name && sub.name.toLowerCase().includes('lab'));
            if (isLab) {
                slotsToFill.push({ subject: sub, duration: 3, type: 'Lab', requiredTeachers: sub.requiredTeachers || 1 });
            } else {
                for (let i = 0; i < hoursNeeded; i++) {
                    slotsToFill.push({ subject: sub, duration: 1, type: 'Theory', requiredTeachers: sub.requiredTeachers || 1 });
                }
            }
        });

        Object.keys(electiveGroups).forEach(groupName => {
            const groupSubjs = electiveGroups[groupName];
            const hoursNeeded = parseInt(groupSubjs[0].teachingHours || groupSubjs[0].credits || 3);
            for (let i = 0; i < hoursNeeded; i++) {
                slotsToFill.push({ isParallel: true, groupName, subjects: groupSubjs, duration: 1, type: 'Elective' });
            }
        });

        return this.backtrack(dept, sem, div, slotsToFill, 0);
    }

    backtrack(dept, sem, div, slots, index) {
        this.steps++;
        if (this.steps > this.MAX_STEPS || index >= slots.length) return index >= slots.length;

        const currentSlotRequest = slots[index];
        const { duration, isParallel, subjects, groupName } = currentSlotRequest;

        if (isParallel) {
            const sortedDays = [...DAYS].sort((a, b) => Math.random() - 0.5);
            for (let day of sortedDays) {
                const currentGridDay = this.timetables[dept][sem][div][day] || {};
                if (Object.values(currentGridDay).some(s => s.groupName === groupName)) continue;

                let hourIndices = Array.from({ length: HOURS.length }, (_, i) => i).sort(() => Math.random() - 0.5);
                for (let h of hourIndices) {
                    const hourLabel = HOURS[h];
                    if (currentGridDay[hourLabel]) continue;

                    const resolvedAssignments = [];
                    let allResolved = true;

                    for (const sub of subjects) {
                        let existingTid = null;
                        Object.values(this.timetables[dept][sem][div] || {}).forEach(dObj => {
                            Object.values(dObj).forEach(s => { if (s.subject === sub.name && s.teacherId) existingTid = s.teacherId; });
                        });

                        const eligibleTeachers = this.teachers.filter(t => existingTid ? t.id === existingTid : t.department === dept);
                        const candidates = eligibleTeachers.map(t => {
                            const isBusy = !this.teacherAvailability[t.id][day][hourLabel];
                            const loadBusy = this.teacherWorkLoad[t.id].total >= 24;
                            let score = 0;
                            const pref = this.preferences.find(p => p.email === t.email);
                            if (pref && (pref.subjectPref1 === sub.name || pref.subjectPref2 === sub.name)) score += 100;
                            return { teacher: t, score: isBusy || loadBusy ? -1 : score };
                        }).filter(c => c.score >= 0).sort((a, b) => b.score - a.score);

                        if (candidates.length > 0) {
                            resolvedAssignments.push({ subject: sub, teacher: candidates[0].teacher });
                        } else {
                            allResolved = false;
                            break;
                        }
                    }

                    if (allResolved) {
                        const parallelSlot = {
                            subject: groupName, groupName, isParallel: true, type: 'Elective', department: dept, semester: sem, division: div,
                            parallelSlots: resolvedAssignments.map(asm => ({
                                subject: asm.subject.name, code: asm.subject.code, teacherName: asm.teacher.name, teacherId: asm.teacher.id,
                                teacherEmpId: asm.teacher.employeeId, room: `Room ${sem.replace(/\D/g, '')}-${div}-${asm.subject.code}`
                            }))
                        };
                        if (!this.timetables[dept][sem][div][day]) this.timetables[dept][sem][div][day] = {};
                        this.timetables[dept][sem][div][day][hourLabel] = parallelSlot;
                        resolvedAssignments.forEach(asm => {
                            this.teacherAvailability[asm.teacher.id][day][hourLabel] = false;
                            this.teacherWorkLoad[asm.teacher.id].total++;
                            this.teacherWorkLoad[asm.teacher.id].daily[day]++;
                        });
                        if (this.backtrack(dept, sem, div, slots, index + 1)) return true;
                        delete this.timetables[dept][sem][div][day][hourLabel];
                        resolvedAssignments.forEach(asm => {
                            this.teacherAvailability[asm.teacher.id][day][hourLabel] = true;
                            this.teacherWorkLoad[asm.teacher.id].total--;
                            this.teacherWorkLoad[asm.teacher.id].daily[day]--;
                        });
                    }
                }
            }
            return false;
        }

        const { subject } = currentSlotRequest;
        let candidates = this.teachers.filter(t => t.department === dept).map(teacher => {
            const tid = teacher.id;
            const workLoad = this.teacherWorkLoad[tid];
            if (!workLoad || workLoad.total >= 24) return null;

            let score = 0;
            const isAlreadyTeachingThis = Object.values(this.timetables[dept][sem][div] || {}).some(dObj => Object.values(dObj).some(s => s.teacherId === tid && s.subject === subject.name));
            if (isAlreadyTeachingThis) score += 500;
            
            const pref = this.preferences.find(p => p.email === teacher.email || p.id === tid);
            if (pref) {
                if (pref.subjectPref1 === subject.name) score += 100;
                else if (pref.subjectPref2 === subject.name) score += 50;
            }
            score += (18 - workLoad.total) * 2;
            return { teacher, score };
        }).filter(c => c !== null).sort((a, b) => b.score - a.score);

        let possibleTeachers = candidates.map(c => c.teacher);
        let existingTid = null;
        Object.values(this.timetables[dept][sem][div] || {}).forEach(dObj => Object.values(dObj).forEach(s => { if (s.subject === subject.name && s.teacherId) existingTid = s.teacherId; }));
        if (existingTid) possibleTeachers = possibleTeachers.filter(t => t.id === existingTid);
        if (possibleTeachers.length === 0) possibleTeachers = [null];

        const sortedDays = [...DAYS].sort((a, b) => {
            const count = (d) => Object.values(this.timetables[dept][sem][div][d] || {}).filter(s => s.subject === subject.name).length;
            return count(a) - count(b);
        });

        for (let day of sortedDays) {
            if (currentSlotRequest.type === 'Theory' && Object.values(this.timetables[dept][sem][div][day] || {}).some(s => s.subject === subject.name)) continue;

            let hourIndices = Array.from({ length: HOURS.length }, (_, i) => i);
            if (currentSlotRequest.type === 'Theory') hourIndices.sort(() => Math.random() - 0.5);

            for (let h of hourIndices) {
                if (duration === 3 && (h !== 0 && h !== 1 && h !== 4)) continue;
                if (h + duration > HOURS.length) continue;

                const reqCount = currentSlotRequest.requiredTeachers || 1;
                if (reqCount === 1) {
                    for (const teacher of possibleTeachers) {
                        let isFree = true;
                        for (let i = 0; i < duration; i++) {
                            const hourLabel = HOURS[h + i];
                            if ((this.timetables[dept][sem][div][day] && this.timetables[dept][sem][div][day][hourLabel]) || (teacher && !this.teacherAvailability[teacher.id][day][hourLabel])) { isFree = false; break; }
                        }
                        if (isFree && (!teacher || (this.teacherWorkLoad[teacher.id].total + duration <= 24 && this.teacherWorkLoad[teacher.id].daily[day] + duration <= 6))) {
                            this.assignSlot(dept, sem, div, day, h, duration, subject, currentSlotRequest.type, teacher);
                            if (this.backtrack(dept, sem, div, slots, index + 1)) return true;
                            this.unassignSlot(dept, sem, div, day, h, duration, teacher);
                        }
                    }
                } else if (reqCount === 2) {
                    for (let i = 0; i < possibleTeachers.length; i++) {
                        for (let j = i + 1; j < possibleTeachers.length; j++) {
                            const t1 = possibleTeachers[i], t2 = possibleTeachers[j];
                            if (!t1 || !t2) continue;
                            let isFree = true;
                            for (let k = 0; k < duration; k++) {
                                const hourLabel = HOURS[h + k];
                                if ((this.timetables[dept][sem][div][day] && this.timetables[dept][sem][div][day][hourLabel]) || !this.teacherAvailability[t1.id][day][hourLabel] || !this.teacherAvailability[t2.id][day][hourLabel]) { isFree = false; break; }
                            }
                            if (isFree && this.teacherWorkLoad[t1.id].total + duration <= 24 && this.teacherWorkLoad[t2.id].total + duration <= 24) {
                                this.assignSlot(dept, sem, div, day, h, duration, subject, currentSlotRequest.type, null, [t1, t2]);
                                if (this.backtrack(dept, sem, div, slots, index + 1)) return true;
                                this.unassignSlot(dept, sem, div, day, h, duration, null, [t1, t2]);
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    assignSlot(dept, sem, div, day, start, duration, subject, type, teacher, multi = null) {
        for (let i = 0; i < duration; i++) {
            const hour = HOURS[start + i];
            const slot = {
                subject: subject.name, code: subject.code, type, 
                teacherName: teacher ? teacher.name : (multi ? multi.map(t => t.name).join(' & ') : "Unassigned"),
                teacherId: teacher ? teacher.id : "", teacherEmpId: teacher ? teacher.employeeId : "",
                multiTeachers: multi ? multi.map(t => ({ teacherId: t.id, teacherName: t.name, teacherEmpId: t.employeeId })) : null,
                room: `Room ${sem.replace(/\D/g, '')}-${div}`, department: dept, semester: sem, division: div
            };
            if (!this.timetables[dept][sem][div][day]) this.timetables[dept][sem][div][day] = {};
            this.timetables[dept][sem][div][day][hour] = slot;
            if (teacher) this.markBusy(teacher.id, day, hour);
            if (multi) multi.forEach(t => this.markBusy(t.id, day, hour));
        }
    }

    unassignSlot(dept, sem, div, day, start, duration, teacher, multi = null) {
        for (let i = 0; i < duration; i++) {
            const hour = HOURS[start + i];
            delete this.timetables[dept][sem][div][day][hour];
            if (teacher) {
                this.teacherAvailability[teacher.id][day][hour] = true;
                this.teacherWorkLoad[teacher.id].total--;
                this.teacherWorkLoad[teacher.id].daily[day]--;
            }
            if (multi) multi.forEach(t => {
                this.teacherAvailability[t.id][day][hour] = true;
                this.teacherWorkLoad[t.id].total--;
                this.teacherWorkLoad[t.id].daily[day]--;
            });
        }
    }
}
