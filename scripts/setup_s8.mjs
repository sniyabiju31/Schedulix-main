import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, push, update } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCQod8ApYVMhDf0eW6uUDemZcbZPzcw2TE",
  authDomain: "schedulix-de3be.firebaseapp.com",
  databaseURL: "https://schedulix-de3be-default-rtdb.firebaseio.com",
  projectId: "schedulix-de3be",
  storageBucket: "schedulix-de3be.firebasestorage.app",
  messagingSenderId: "555062503511",
  appId: "1:555062503511:web:dd212e3cf7e16ec1e8db12",
  measurementId: "G-QZRM2PD4DX"
};

const app = initializeApp(firebaseConfig);
const rtdb = getDatabase(app);

const s8Teachers = [
    { name: "Dr. Valanto Alappat", email: "valanto.alappat.jec@gmail.com", employeeId: "T_VALANTO", department: "Computer Science" },
    { name: "Ms. Aswathy Wilson", email: "aswathy.wilson.jec@gmail.com", employeeId: "T_ASWATHY", department: "Computer Science" },
    { name: "Dr. Shyjith M B", email: "shyjith.mb.jec@gmail.com", employeeId: "T_SHYJITH", department: "Computer Science" },
    { name: "Ms. Aparna Mohan", email: "aparna.mohan.jec@gmail.com", employeeId: "T_APARNA", department: "Computer Science" },
    { name: "Ms. Jyothi P Joy", email: "jyothi.pjoy.jec@gmail.com", employeeId: "T_JYOTHI", department: "Computer Science" },
    { name: "Ms. Neeraja James", email: "neeraja.james.jec@gmail.com", employeeId: "T_NEERAJA", department: "Computer Science" },
    { name: "Ms. Neethu T V", email: "neethu.tv.jec@gmail.com", employeeId: "T_NEETHU", department: "Computer Science" },
    { name: "Ms. Sruthy K S", email: "sruthy.ks.jec@gmail.com", employeeId: "T_SRUTHY", department: "Computer Science" },
    { name: "Dr. Sobha Xavier P", email: "sobha.xavier.jec@gmail.com", employeeId: "T_SOBHA", department: "Computer Science" },
    { name: "Mr. Arun K", email: "arun.k.jec@gmail.com", employeeId: "T_ARUN", department: "Computer Science" },
    { name: "Ms. Athira K P", email: "athira.kp.jec@gmail.com", employeeId: "T_ATHIRA", department: "Computer Science" },
    { name: "Ms. Sonia Joseph", email: "sonia.joseph.jec@gmail.com", employeeId: "T_SONIA", department: "Computer Science" }
];

const s8Subjects = [
    { code: "CST402", name: "DISTRIBUTED COMPUTING", credits: 3, teachingHours: 3, type: "Theory", department: "Computer Science", semester: "Semester 8" },
    { code: "CST404", name: "COMPREHENSIVE COURSE VIVA", credits: 1, teachingHours: 1, type: "Theory", department: "Computer Science", semester: "Semester 8" },
    { code: "CSD416", name: "PROJECT PHASE II", credits: 4, teachingHours: 12, type: "Lab", department: "Computer Science", semester: "Semester 8" },
    { code: "CST426", name: "DATA MINING", credits: 3, teachingHours: 3, type: "Theory", department: "Computer Science", semester: "Semester 8" },
    { code: "CST464", name: "EMBEDDED SYSTEMS", credits: 3, teachingHours: 3, type: "Theory", department: "Computer Science", semester: "Semester 8" },
    { code: "CST426_MC", name: "MOBILE COMPUTING", credits: 3, teachingHours: 3, type: "Theory", department: "Computer Science", semester: "Semester 8" },
    { code: "CST444", name: "SOFT COMPUTING", credits: 3, teachingHours: 3, type: "Theory", department: "Computer Science", semester: "Semester 8" },
    { code: "CST458", name: "SOFTWARE TESTING", credits: 3, teachingHours: 3, type: "Theory", department: "Computer Science", semester: "Semester 8" },
    { code: "PTL", name: "PT & Library", credits: 0, teachingHours: 1, type: "Theory", department: "Computer Science", semester: "Semester 8" }
];

async function setup() {
    console.log("Setting up Semester 8 Division Settings...");
    await update(ref(rtdb, 'settings/divisions/Computer Science'), { "Semester 8": 2 });

    console.log("Checking and Syncing Teachers...");
    const teachersRef = ref(rtdb, 'teachers');
    const teachSnap = await get(teachersRef);
    const existingTeachers = teachSnap.exists() ? Object.values(teachSnap.val()) : [];

    for (const st of s8Teachers) {
        const found = existingTeachers.find(t => t.email === st.email || t.employeeId === st.employeeId);
        if (!found) {
            console.log(`Adding Teacher: ${st.name}`);
            const newRef = push(teachersRef);
            await set(newRef, { ...st, createdAt: Date.now() });
        } else {
            console.log(`Teacher already exists: ${st.name}`);
        }
    }

    console.log("Checking and Syncing Subjects...");
    const subjectsRef = ref(rtdb, 'subjects');
    const subSnap = await get(subjectsRef);
    const existingSubjects = subSnap.exists() ? Object.values(subSnap.val()) : [];

    for (const ss of s8Subjects) {
        const found = existingSubjects.find(s => s.code === ss.code && s.semester === ss.semester);
        if (!found) {
            console.log(`Adding Subject: ${ss.name}`);
            const newRef = push(subjectsRef);
            await set(newRef, { ...ss, createdAt: Date.now() });
        }
    }

    console.log("Adding Preferences to force teacher assignment...");
    const assignments = [
        { email: "aswathy.wilson.jec@gmail.com", sub: "DISTRIBUTED COMPUTING", div: "A" },
        { email: "sobha.xavier.jec@gmail.com", sub: "DISTRIBUTED COMPUTING", div: "B" },
        { email: "valanto.alappat.jec@gmail.com", sub: "COMPREHENSIVE COURSE VIVA", div: "A" },
        { email: "sobha.xavier.jec@gmail.com", sub: "COMPREHENSIVE COURSE VIVA", div: "B" },
        { email: "shyjith.mb.jec@gmail.com", sub: "PROJECT PHASE II", div: "A" },
        { email: "athira.kp.jec@gmail.com", sub: "PROJECT PHASE II", div: "B" },
        { email: "aparna.mohan.jec@gmail.com", sub: "DATA MINING", div: "A" }, // Shared
        { email: "aparna.mohan.jec@gmail.com", sub: "DATA MINING", div: "B" }, // Shared
        { email: "neeraja.james.jec@gmail.com", sub: "EMBEDDED SYSTEMS", div: "A" }, // Shared
        { email: "neethu.tv.jec@gmail.com", sub: "MOBILE COMPUTING", div: "A" },
        { email: "sruthy.ks.jec@gmail.com", sub: "SOFT COMPUTING", div: "A" },
        { email: "arun.k.jec@gmail.com", sub: "SOFT COMPUTING", div: "B" },
        { email: "jyothi.pjoy.jec@gmail.com", sub: "SOFTWARE TESTING", div: "A" },
        { email: "sonia.joseph.jec@gmail.com", sub: "SOFTWARE TESTING", div: "B" },
        { email: "aswathy.wilson.jec@gmail.com", sub: "PT & Library", div: "A" },
        { email: "arun.k.jec@gmail.com", sub: "PT & Library", div: "B" }
    ];

    const prefsRef = ref(rtdb, 'preferences');
    const prefSnap = await get(prefsRef);
    const existingPrefs = prefSnap.exists() ? Object.values(prefSnap.val()) : [];

    for (const ass of assignments) {
        const found = existingPrefs.find(p => p.email === ass.email && p.subjectPref1 === ass.sub && p.classPref1 === `Semester 8 ${ass.div}`);
        if (!found) {
            console.log(`Adding Preference for ${ass.email} -> ${ass.sub} (${ass.div})`);
            const newRef = push(prefsRef);
            await set(newRef, {
                email: ass.email,
                subjectPref1: ass.sub,
                classPref1: `Semester 8 ${ass.div}`,
                updatedAt: Date.now()
            });
        }
    }

    console.log("Setup complete!");
    process.exit(0);
}

setup().catch(err => {
    console.error(err);
    process.exit(1);
});
