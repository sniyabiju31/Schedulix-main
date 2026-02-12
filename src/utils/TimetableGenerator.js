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

        // Result: { Department: { Semester: { Day: { Hour: Slot } } } }
        this.timetables = {};

        // Helper to track teacher availability: { TeacherID: { Day: { Hour: true/false } } }
        this.teacherAvailability = {};

        this.debugInfo = []; // Store failure reasons
    }

    log(msg) {
        if (this.debugInfo.length < 20) this.debugInfo.push(msg); // Limit logs
    }

    generate(divisions = ['A']) {
        this.initialize();
        // ... rest of generate

        // Expand subjects for each division
        const expandedSubjects = [];
        this.subjects.forEach(sub => {
            divisions.forEach(div => {
                expandedSubjects.push({ ...sub, division: div });
            });
        });

        // Group subjects by Class (Dept + Sem + Div)
        const classes = this.groupSubjectsByClass(expandedSubjects);
        console.log("Generator - Classes to schedule:", Object.keys(classes));

        // Process each class
        for (const classKey in classes) {
            const classSubjects = classes[classKey];
            const sample = classSubjects[0];
            const dept = sample.department;
            const sem = sample.semester;
            const div = sample.division;

            // Initialize class grid
            if (!this.timetables[dept]) this.timetables[dept] = {};
            if (!this.timetables[dept][sem]) this.timetables[dept][sem] = {};
            if (!this.timetables[dept][sem][div]) this.timetables[dept][sem][div] = {};

            // Sort subjects: Labs first (Hard constraint), then Theory
            classSubjects.sort((a, b) => {
                const aIsLab = a.type === 'Lab' || a.credits > 3 || (a.teachingHours && a.teachingHours > 1);
                const bIsLab = b.type === 'Lab' || b.credits > 3 || (b.teachingHours && b.teachingHours > 1);
                if (aIsLab && !bIsLab) return -1;
                if (!aIsLab && bIsLab) return 1;
                return 0;
            });

            // Attempt to schedule
            const success = this.scheduleClass(dept, sem, div, classSubjects);
            if (!success) {
                console.warn(`Could not fully schedule for ${dept} - ${sem} - ${div}`);
            }
        }
        console.log("Generator - Success!", this.timetables);
        return this.timetables;
    }

    initialize() {
        this.timetables = {};
        this.teacherAvailability = {};

        // 1. Initialize all teachers as Free
        this.teachers.forEach(t => {
            const tid = t.id || t.employeeId;
            this.teacherAvailability[tid] = {};
            DAYS.forEach(d => {
                this.teacherAvailability[tid][d] = {};
                HOURS.forEach(h => {
                    this.teacherAvailability[tid][d][h] = true; // Free
                });
            });
        });

        // 2. Mark Busy based on Existing Timetables
        if (this.existingTimetables) {
            Object.values(this.existingTimetables).forEach(deptObj => {
                Object.values(deptObj).forEach(semObj => {
                    Object.values(semObj).forEach(divObj => {
                        // Some structure might not have div layer if legacy, handle carefully
                        // If structure is timetables/Dept/Sem/Day/Hour (legacy) vs timetables/Dept/Sem/Div/Day/Hour
                        // The prompt implies we are moving to Divs. 
                        // Let's assume if it has Day keys, it's a schedule, else iterate deeper.

                        const processSchedule = (schedule) => {
                            if (!schedule) return;
                            Object.keys(schedule).forEach(day => {
                                if (DAYS.includes(day)) {
                                    const daySlots = schedule[day];
                                    Object.keys(daySlots).forEach(hour => {
                                        const slot = daySlots[hour];
                                        if (slot && slot.teacherId && this.teacherAvailability[slot.teacherId]) {
                                            // Mark Busy
                                            if (this.teacherAvailability[slot.teacherId][day]) {
                                                this.teacherAvailability[slot.teacherId][day][hour] = false;
                                                // console.log(`Marking ${slot.teacherName} busy on ${day} ${hour}`);
                                            }
                                        }
                                    });
                                }
                            });
                        };

                        // Robust check: Is this node a Schedule (has Monday/Tuesday)? or a Map of Divs?
                        const keys = Object.keys(divObj || {});
                        const isSchedule = keys.some(k => DAYS.includes(k));

                        if (isSchedule) {
                            processSchedule(divObj);
                        } else {
                            // Iterate Divisions
                            Object.values(divObj).forEach(innerSched => processSchedule(innerSched));
                        }
                    });
                });
            });
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
        const slotsToFill = [];

        subjects.forEach(sub => {
            // Default to 4 hours/week if not specified (standard)
            const hoursNeeded = parseInt(sub.teachingHours || sub.credits || 4);

            // Only treat as Lab block if explicitly marked or named Lab
            const isLab = sub.type === 'Lab' || (sub.name && sub.name.toLowerCase().includes('lab'));

            if (isLab) {
                // Labs are single blocks of 3 hours (or teachingHours if specified/valid)
                // Assuming standard lab is 3 hours
                slotsToFill.push({
                    subject: sub,
                    duration: 3,
                    type: 'Lab'
                });
            } else {
                for (let i = 0; i < hoursNeeded; i++) {
                    slotsToFill.push({
                        subject: sub,
                        duration: 1,
                        type: 'Theory'
                    });
                }
            }
        });

        console.log(`Generator - Scheduling ${dept} ${sem} ${div}. Slots: ${slotsToFill.length}`);
        return this.backtrack(dept, sem, div, slotsToFill, 0);
    }

    backtrack(dept, sem, div, slots, index) {
        if (index >= slots.length) return true; // All slots filled!

        // Limit labs per day
        const totalLabs = slots.filter(s => s.type === 'Lab' || s.duration === 3).length;
        const maxLabsPerDay = totalLabs > 5 ? 2 : 1;

        const currentSlotRequest = slots[index];
        const { subject, duration } = currentSlotRequest;

        // 1. Find Preferred Teachers & Load Balance
        let candidates = [];
        const deptTeachers = this.teachers.filter(t => t.department === dept);

        // Calculate current load for each candidate
        const getTeacherLoad = (tid) => {
            let load = 0;
            // Iterate all scheduled slots to count
            Object.values(this.timetables).forEach(d => {
                Object.values(d).forEach(s => {
                    Object.values(s).forEach(divObj => {
                        Object.values(divObj).forEach(dayObj => { // Day
                            Object.values(dayObj).forEach(slot => {
                                if (slot.teacherId === tid) load++;
                            });
                        });
                    });
                });
            });
            return load;
        };

        deptTeachers.forEach(teacher => {
            let score = 0;
            const pref = this.preferences.find(p => p.email === teacher.email);
            const teacherPref = this.preferences.find(p => p.id === teacher.id);
            const pObj = teacherPref || pref;

            if (pObj) {
                const subjects = [pObj.subjectPref1, pObj.subjectPref2, pObj.subjectPref3];
                const classes = [pObj.classPref1, pObj.classPref2, pObj.classPref3];
                const subIndex = subjects.findIndex(s => s === subject.name);

                if (subIndex === 0) score += 100;
                else if (subIndex === 1) score += 50;
                else if (subIndex === 2) score += 25;

                if (subIndex !== -1) {
                    if (classes[subIndex] && classes[subIndex].endsWith(` ${div}`)) {
                        score += 20;
                    }
                }
            }

            // Consistency Bonus: If this teacher is ALREADY teaching this subject to this class, HUGE bonus.
            // This ensures "Teacher A" keeps teaching "Maths" to "Class 1A" for all slots.
            const isAlreadyTeachingThis = Object.values(this.timetables[dept][sem][div] || {}).some(dayObj => {
                return Object.values(dayObj).some(s => s.teacherId === teacher.id && s.subject === subject.name);
            });

            if (isAlreadyTeachingThis) {
                score += 500; // Massive bonus to lock them in
            } else {
                // ... only apply other logic (prefs/load) if not locked yet
            }

            // Load Balancing Penalty (only if not already locked)
            if (!isAlreadyTeachingThis) {
                const currentLoad = getTeacherLoad(teacher.id);
                score -= (currentLoad * 10);
            }

            candidates.push({ teacher, score });
        });

        candidates.sort((a, b) => b.score - a.score);
        let possibleTeachers = candidates.map(c => c.teacher);

        // 2. Fallback: If preferences exist, 'possibleTeachers' only has them.
        // We MUST append the rest of the dept teachers to avoid failure if preferred ones are busy.
        const preferredIDs = new Set(possibleTeachers.map(t => t.id));
        const otherDeptTeachers = this.teachers.filter(t => t.department === dept && !preferredIDs.has(t.id));

        // Shuffle others to distribute load randomly
        otherDeptTeachers.sort(() => Math.random() - 0.5);

        // Combine: Preferred First -> Then Others
        possibleTeachers = [...possibleTeachers, ...otherDeptTeachers];

        if (possibleTeachers.length === 0) {
            console.warn(`No teacher found for ${subject.name} in ${dept}. Using 'Unassigned'.`);
            possibleTeachers = [null];
        }

        // Helper to count occurrences of this subject on a specific day
        const getDailySubjectCount = (d) => {
            if (!this.timetables[dept][sem][div][d]) return 0;
            return Object.values(this.timetables[dept][sem][div][d])
                .filter(slot => slot.subject === subject.name)
                .length;
        };

        const sortedDays = [...DAYS].sort((a, b) => {
            return getDailySubjectCount(a) - getDailySubjectCount(b);
        });

        // Try Timeslots
        for (let d = 0; d < sortedDays.length; d++) {
            const day = sortedDays[d];

            // Hard Constraint: Max 2 periods per day for Theory
            if (currentSlotRequest.type === 'Theory') {
                if (getDailySubjectCount(day) >= 2) {
                    this.log(`Rejected ${subject.name} on ${day}: Max 2 theory/day`);
                    continue;
                }
            }

            // Hard Constraint: Max Lab limit per Day
            if (currentSlotRequest.type === 'Lab' || duration === 3) {
                const daySlots = this.timetables[dept][sem][div][day] || {};
                const dailyLabCount = Object.values(daySlots).filter(s => s.type === 'Lab' || (s.subject && s.subject.includes('Lab'))).length;

                if (dailyLabCount >= maxLabsPerDay) {
                    this.log(`Rejected ${subject.name} on ${day}: Max ${maxLabsPerDay} Lab limit reached`);
                    continue;
                }
            }

            for (let h = 0; h < HOURS.length; h++) {
                // --- CONSTRAINT CHECKING ---

                // 1. Lab Constraints
                if (duration === 3) {
                    if (h !== 0 && h !== 1 && h !== 4) continue;
                    if (h + duration > HOURS.length) continue;
                }

                // 2. Theory Constraints
                if (currentSlotRequest.type === 'Theory') {
                    const currentGridDay = this.timetables[dept][sem][div][day] || {};
                    const prevSlot = currentGridDay[HOURS[h - 1]];
                    if (prevSlot && prevSlot.subject === subject.name && prevSlot.type === 'Theory') continue;
                    const nextSlot = currentGridDay[HOURS[h + 1]];
                    if (nextSlot && nextSlot.subject === subject.name && nextSlot.type === 'Theory') continue;
                }

                // Try ALL Possible Teachers for this slot
                for (const teacher of possibleTeachers) {
                    let isFree = true;
                    let rejectionReason = "";

                    // Check Time Constraints & Availability
                    for (let i = 0; i < duration; i++) {
                        const timeIdx = h + i;
                        if (timeIdx >= HOURS.length) { isFree = false; break; }
                        const hourLabel = HOURS[timeIdx];

                        // Check Class Free
                        if (this.timetables[dept][sem][div][day] && this.timetables[dept][sem][div][day][hourLabel]) {
                            isFree = false; break;
                        }

                        // Check Teacher Free
                        if (teacher && !this.teacherAvailability[teacher.id][day][hourLabel]) {
                            isFree = false; break;
                        }
                    }

                    if (isFree) {
                        // ASSIGN
                        for (let i = 0; i < duration; i++) {
                            const hourLabel = HOURS[h + i];
                            const hourSlot = {
                                subject: subject.name,
                                code: subject.code,
                                type: currentSlotRequest.type,
                                teacherName: teacher ? teacher.name : "Unassigned",
                                teacherEmpId: teacher ? teacher.employeeId : "",
                                teacherId: teacher ? teacher.id : "",
                                avgRating: teacher ? (teacher.avgRating || 0) : 0,
                                room: `Room ${sem.replace(/\D/g, '')}-${div}`,
                                department: dept,
                                semester: sem,
                                division: div
                            };

                            if (!this.timetables[dept][sem][div][day]) this.timetables[dept][sem][div][day] = {};
                            this.timetables[dept][sem][div][day][hourLabel] = hourSlot;

                            if (teacher) {
                                this.teacherAvailability[teacher.id][day][hourLabel] = false;
                            }
                        }

                        // RECURSE
                        if (this.backtrack(dept, sem, div, slots, index + 1)) {
                            return true;
                        }

                        // BACKTRACK (Unassign)
                        for (let i = 0; i < duration; i++) {
                            const hourLabel = HOURS[h + i];
                            delete this.timetables[dept][sem][div][day][hourLabel];
                            if (teacher) {
                                this.teacherAvailability[teacher.id][day][hourLabel] = true;
                            }
                        }
                    }
                }
            }
        }

        this.log(`Failed to schedule ${subject.name} type ${currentSlotRequest.type} (Index: ${index}). Tried all dates/times.`);
        console.warn(`Backtrack failed to schedule ${subject.name} (${currentSlotRequest.type}) at index ${index}`);
        return false; // No slot found for this subject
    }
}
