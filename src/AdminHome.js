import React, { useState, useEffect } from "react";
import "./AdminHome.css";
import { auth, db, firebaseConfig, rtdb, cloudFunctions } from "./firebase";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref as rtdbRef, get as rtdbGet, push, set, update, remove, query as rtdbQuery, orderByChild, equalTo } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { LayoutDashboard, ClipboardList, Calendar, Clock, PlusCircle, GraduationCap, Users } from "lucide-react";
import { TimetableGenerator } from "./utils/TimetableGenerator";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const hours = ["9:00-9:50", "9:50-10:40", "10:50-11:40", "11:40-12:30", "1:20-2:10", "2:20-3:10", "3:10-4:00"];

const classes = ["Class 10A", "Class 10B", "Class 9A", "Class 9B", "Class 8A"];
const teachers = ["Mr. Smith", "Ms. Johnson", "Mr. Davis", "Ms. Wilson", "Mr. Brown"];
const departments = ["Computer Science", "Electronics & Communication", "Mechanical Engineering", "Civil Engineering", "Electrical & Electronics", "Information Technology", "Artificial Intelligence", "Cyber Security"];
const schemes = ["2015 Scheme", "2019 Scheme", "2024 Scheme"];
const categories = ["Core", "Elective", "Non Credit", "Minor", "Honor"];

const deptCodes = {
  "Computer Science": "CS",
  "Electronics & Communication": "EC",
  "Mechanical Engineering": "ME",
  "Civil Engineering": "CE",
  "Electrical & Electronics": "EE",
  "Information Technology": "IT",
  "Artificial Intelligence": "AI",
  "Cyber Security": "CY"
};

const AdminHomePage = () => {
  const [user, setUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState("overview");
  const [selectedDept, setSelectedDept] = useState(departments[0]);
  const [selectedSemester, setSelectedSemester] = useState("Semester 1");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [timetableData, setTimetableData] = useState({});
  const [masterTimetableData, setMasterTimetableData] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [currentSlot, setCurrentSlot] = useState(null); // { day, hour }
  const [subject, setSubject] = useState("");
  const [teacher, setTeacher] = useState("");
  const [room, setRoom] = useState("");
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  // const [users, setUsers] = useState({}); // Unused
  const [teachersObj, setTeachersObj] = useState({}); // Renamed to avoid conflict with teachersList
  const [students, setStudents] = useState({});
  const [settings, setSettings] = useState({ student_update_window: { start: 0, end: 0 } });


  // Subjects management
  const [semester, setSemester] = useState("Semester 1");
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [department, setDepartment] = useState("Computer Science");
  const [credits, setCredits] = useState("");
  const [teachingHours, setTeachingHours] = useState("");

  const [subjectType, setSubjectType] = useState("Theory");
  const [subjectCategory, setSubjectCategory] = useState("Core");
  const [subjectScheme, setSubjectScheme] = useState(schemes[schemes.length - 1]);
  const [customScheme, setCustomScheme] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [subjectsList, setSubjectsList] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState(null);

  // Teachers management
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherDept, setTeacherDept] = useState("Computer Science");
  const [teacherEmpId, setTeacherEmpId] = useState("");
  const [isTutor, setIsTutor] = useState(false);
  const [tutorClassDept, setTutorClassDept] = useState("Computer Science");
  const [tutorClassSem, setTutorClassSem] = useState("Semester 1");
  const [tutorClassDiv, setTutorClassDiv] = useState("A");
  const [isAdmissionDuty, setIsAdmissionDuty] = useState(false);
  const [admissionDutyStartDate, setAdmissionDutyStartDate] = useState("");
  const [admissionDutyEndDate, setAdmissionDutyEndDate] = useState("");
  const [admissionDutyStartTime, setAdmissionDutyStartTime] = useState("");
  const [admissionDutyEndTime, setAdmissionDutyEndTime] = useState("");
  const [teachersList, setTeachersList] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  // Student Form State
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentDept, setStudentDept] = useState("CSE");
  const [studentSemester, setStudentSemester] = useState("1");
  const [studentDivision, setStudentDivision] = useState("A");
  const [studentDOB, setStudentDOB] = useState("");
  const [studentFatherName, setStudentFatherName] = useState("");
  const [studentMotherName, setStudentMotherName] = useState("");
  const [studentReligion, setStudentReligion] = useState("");
  const [studentCaste, setStudentCaste] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [studentGuardianName, setStudentGuardianName] = useState("");
  const [studentGuardianAddress, setStudentGuardianAddress] = useState("");
  const [studentTotalFees, setStudentTotalFees] = useState(0);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [studentsList, setStudentsList] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentFilterDept, setStudentFilterDept] = useState("All");
  const [studentFilterYear, setStudentFilterYear] = useState("All");
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [collegeCode, setCollegeCode] = useState("JEC");
  const [admissionYear, setAdmissionYear] = useState(new Date().getFullYear().toString().slice(-2));

  // Settings State
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Preferences management
  const [preferencesList, setPreferencesList] = useState([]);
  const [loadingPreferences, setLoadingPreferences] = useState(false);

  // Division Settings State
  const [divisionSettings, setDivisionSettings] = useState({}); // { Dept: { Sem: Count } }
  const [loadingDivisions, setLoadingDivisions] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState("A");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      try {
        if (user) {
          const docRef = doc(db, "admin", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUser(docSnap.data());
            const studentsRef = rtdbRef(rtdb, 'students');
            rtdbGet(studentsRef).then((snap) => {
              if (snap.exists()) {
                const data = snap.val();
                setStudents(data);
                setStudentsList(Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a, b) => (a.department || "").localeCompare(b.department || "") || (a.name || "").localeCompare(b.name || "")));
              }
            });

            const settingsRef = rtdbRef(rtdb, 'settings');
            rtdbGet(settingsRef).then((snap) => {
              if (snap.exists()) {
                const data = snap.val();
                setSettings(data);
                if (data.student_update_window) {
                  const startTs = Number(data.student_update_window.start);
                  const endTs = Number(data.student_update_window.end);
                  if (startTs && !isNaN(startTs)) setWindowStart(new Date(startTs).toISOString().slice(0, 16));
                  if (endTs && !isNaN(endTs)) setWindowEnd(new Date(endTs).toISOString().slice(0, 16));
                  const { start, end, isUnlocked } = data.student_update_window;
                  if (start && !isNaN(new Date(start).getTime())) {
                    setWindowStart(new Date(start).toISOString().slice(0, 16));
                  }
                  if (end && !isNaN(new Date(end).getTime())) {
                    setWindowEnd(new Date(end).toISOString().slice(0, 16));
                  }
                  setIsUnlocked(isUnlocked || false);
                }
              }
            });
            // setUser(docSnap.data());
          } else {
            console.warn("Admin document not found for user:", user.uid);
            alert("Warning: Your account is logged in but does not have an 'Admin' profile in the database. You will not be able to add teachers. Please Sign Out and Sign Up again as an Admin.");
            // setUser(null);
          }
        } else {
          // setUser(null);
        }
      } catch (error) {
        console.error("Auth onAuthStateChanged error (admin):", error);
        alert(`${error.code || "auth/error"}: ${error.message}`);
      }
    });
    return unsubscribe;
  }, []);

  // Fetch Timetable data for selected Dept/Sem
  // Fetch Timetable data
  useEffect(() => {
    if (activeMenu === 'class-timetable') {
      const fetchTimetable = async () => {
        try {
          // Default to 'A' if not specified, but selectedDivision should be set
          const div = selectedDivision || 'A';
          const timetableRef = rtdbRef(rtdb, `timetables/${selectedDept}/${selectedSemester}/${div}`);
          const snap = await rtdbGet(timetableRef);
          if (snap.exists()) {
            setTimetableData(snap.val());
          } else {
            setTimetableData({});
          }
        } catch (err) {
          console.error("Fetch timetable error:", err);
        }
      };
      fetchTimetable();
    } else if (activeMenu === 'teacher-timetable' && selectedTeacherId) {
      const fetchTeacherTimetable = async () => {
        try {
          const rootRef = rtdbRef(rtdb, `timetables`);
          const snap = await rtdbGet(rootRef);
          if (snap.exists()) {
            const allData = snap.val();
            const teacherSchedule = {};

            Object.keys(allData).forEach(dept => {
              const semesters = allData[dept];
              if (semesters) {
                Object.keys(semesters).forEach(sem => {
                  const divisions = semesters[sem];
                  if (divisions) {
                    Object.keys(divisions).forEach(div => {
                      const days = divisions[div];
                      if (days) {
                        Object.keys(days).forEach(day => {
                          const hours = days[day];
                          if (hours) {
                            Object.keys(hours).forEach(hour => {
                              const slot = hours[hour];
                              const teacher = teachersList.find(t =>
                                (t.employeeId && t.employeeId === slot.teacherEmpId) ||
                                (t.name === slot.teacherName)
                              );

                              if (teacher && teacher.id === selectedTeacherId) {
                                if (!teacherSchedule[day]) teacherSchedule[day] = {};
                                // Append Division info to slot
                                teacherSchedule[day][hour] = { ...slot, dept, sem, div };
                              }
                            });
                          }
                        });
                      }
                    });
                  }
                });
              }
            });
            setTimetableData(teacherSchedule);
          } else {
            setTimetableData({});
          }
        } catch (err) {
          console.error("Fetch teacher timetable error:", err);
        }
      };
      fetchTeacherTimetable();
    } else if (activeMenu === 'master-timetable') {
      const fetchMasterTimetable = async () => {
        try {
          const rootRef = rtdbRef(rtdb, `timetables`);
          const snap = await rtdbGet(rootRef);

          // Structure: { TeacherID: { Day: { Hour: { ...classInfo, dept, sem, div } } } }
          const teacherMap = {};

          if (snap.exists()) {
            const allData = snap.val();
            Object.keys(allData).forEach(dept => { // Dept level
              const semesters = allData[dept];
              Object.keys(semesters).forEach(sem => { // Sem level
                const divisions = semesters[sem];
                Object.keys(divisions).forEach(div => { // Division level
                  const daysData = divisions[div];
                  Object.keys(daysData).forEach(day => { // Day level
                    const hoursData = daysData[day];
                    Object.keys(hoursData).forEach(hour => { // Hour level
                      const slot = hoursData[hour];
                      const teacher = teachersList.find(t =>
                        (t.employeeId && t.employeeId === slot.teacherEmpId) ||
                        (t.name === slot.teacherName)
                      );

                      if (teacher) {
                        if (!teacherMap[teacher.id]) teacherMap[teacher.id] = {};
                        if (!teacherMap[teacher.id][day]) teacherMap[teacher.id][day] = {};
                        teacherMap[teacher.id][day][hour] = { ...slot, dept, sem, div };
                      }
                    });
                  });
                });
              });
            });
          }
          setMasterTimetableData(teacherMap);
        } catch (err) {
          console.error("Fetch master timetable error:", err);
        }
      };

      // Ensure teachers are loaded before running this
      if (teachersList.length > 0) {
        fetchMasterTimetable();
      }
    }
  }, [selectedDept, selectedSemester, activeMenu, selectedTeacherId, teachersList, selectedDivision]);

  // Fetch all teachers for the dropdown in the timetable form
  useEffect(() => {
    let mounted = true;
    const fetchAllTeachers = async () => {
      try {
        const teachersRef = rtdbRef(rtdb, 'teachers');
        const snap = await rtdbGet(teachersRef);
        if (!mounted) return;
        if (snap.exists()) {
          const data = snap.val();
          const items = Object.keys(data).map(key => ({ id: key, ...data[key] }));
          setTeachersList(items);
        }
      } catch (err) {
        console.error("Fetch all teachers error:", err);
      }
    };
    fetchAllTeachers();
    return () => { mounted = false; };
  }, []);

  // Fetch subjects for the selected Dept/Sem for the timetable dropdown
  const [availableSubjects, setAvailableSubjects] = useState([]);
  useEffect(() => {
    let mounted = true;
    const fetchSubjectsForTimetable = async () => {
      try {
        const subjectsRef = rtdbRef(rtdb, 'subjects');
        const snap = await rtdbGet(subjectsRef); // Simple list here for now
        if (!mounted) return;
        if (snap.exists()) {
          const data = snap.val();
          const items = Object.keys(data).map(key => ({ id: key, ...data[key] }))
            .filter(sh => sh.department === selectedDept && sh.semester === selectedSemester);
          setAvailableSubjects(items);
        }
      } catch (err) {
        console.error("Fetch subjects error:", err);
      }
    };
    fetchSubjectsForTimetable();
    return () => { mounted = false; };
  }, [selectedDept, selectedSemester]);

  // Reset selectedDivision when Department or Semester changes
  useEffect(() => {
    setSelectedDivision('A');
  }, [selectedDept, selectedSemester]);

  // Fetch users from Realtime Database when 'Users' view is active
  useEffect(() => {
    if (activeMenu !== 'users') return;
    let mounted = true;
    async function fetchUsers() {
      setLoadingUsers(true);
      try {
        // Prefer server-side callable that enforces admin check
        try {
          const resp = await httpsCallable(cloudFunctions, 'listUsersForAdmin')();
          if (!mounted) return;
          if (resp && resp.data && Array.isArray(resp.data.users)) {
            setUsersList(resp.data.users);
            setLoadingUsers(false);
            return;
          }
        } catch (callErr) {
          console.warn('Callable listUsersForAdmin failed or not deployed, falling back to direct RTDB read:', callErr);
        }

        // Fallback: read RTDB directly (requires rules that allow admin read)
        const snap = await rtdbGet(rtdbRef(rtdb, 'users'));
        if (!mounted) return;
        if (snap.exists()) {
          const val = snap.val();
          const users = Object.keys(val).map(uid => ({ uid, ...val[uid] }));
          setUsersList(users);
        } else {
          setUsersList([]);
        }
      } catch (err) {
        console.error('RTDB fetch users error:', err);
        alert(`RTDB fetch users error: ${err.code || ''} ${err.message || err}`);
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    }
    fetchUsers();
    return () => { mounted = false; };
  }, [activeMenu]);


  const handleSignOut = async () => {
    try {
      await auth.signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Sign out error:", error);
      alert(`${error.code || "auth/error"}: ${error.message}`);
    }
  };

  // Fetch subjects for currently selected semester (when admin navigates to Add Subject)
  useEffect(() => {
    if (activeMenu !== 'add-subject') return;
    let mounted = true;
    const fetchSubjects = async () => {
      setLoadingSubjects(true);
      try {
        const subjectsRef = rtdbRef(rtdb, 'subjects');
        const q = rtdbQuery(subjectsRef, orderByChild('semester'), equalTo(semester));
        const snap = await rtdbGet(q);

        if (!mounted) return;

        if (snap.exists()) {
          const data = snap.val();
          const items = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
          }));
          setSubjectsList(items);
        } else {
          setSubjectsList([]);
        }
      } catch (err) {
        console.error("Fetch subjects error:", err);
        alert(`Fetch subjects error: ${err.message || err}`);
      } finally {
        if (mounted) setLoadingSubjects(false);
      }
    };
    fetchSubjects();
    return () => { mounted = false; };
  }, [activeMenu, semester]);

  // Fetch teachers when menu is active
  useEffect(() => {
    if (activeMenu !== 'teachers') return;
    let mounted = true;
    const fetchTeachers = async () => {
      setLoadingTeachers(true);
      try {
        const teachersRef = rtdbRef(rtdb, 'teachers');
        const snap = await rtdbGet(teachersRef);

        if (!mounted) return;

        if (snap.exists()) {
          const data = snap.val();
          const items = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
          }));
          setTeachersList(items);
        } else {
          setTeachersList([]);
        }
      } catch (err) {
        console.error("Fetch teachers error:", err);
      } finally {
        if (mounted) setLoadingTeachers(false);
      }
    };
    fetchTeachers();
    return () => { mounted = false; };
  }, [activeMenu]);

  // Fetch preferences when menu is active
  useEffect(() => {
    if (activeMenu !== 'preferences') return;
    let mounted = true;
    const fetchPreferences = async () => {
      setLoadingPreferences(true);
      try {
        const prefsRef = rtdbRef(rtdb, 'preferences');
        const snap = await rtdbGet(prefsRef);

        if (!mounted) return;

        if (snap.exists()) {
          const data = snap.val();
          const prefs = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
          }));
          setPreferencesList(prefs);
        } else {
          setPreferencesList([]);
        }
      } catch (err) {
        console.error("Fetch preferences error:", err);
      } finally {
        if (mounted) setLoadingPreferences(false);
      }
    };
    fetchPreferences();
    return () => { mounted = false; };
  }, [activeMenu]);

  // Fetch Division Settings
  useEffect(() => {
    // We fetch this generally or when relevant menu is active
    // For now, let's fetch on mount or when 'division-settings' is active to ensure we have it for auto-gen
    const fetchDivisions = async () => {
      setLoadingDivisions(true);
      try {
        const divRef = rtdbRef(rtdb, 'settings/divisions');
        const snap = await rtdbGet(divRef);
        if (snap.exists()) {
          setDivisionSettings(snap.val());
        } else {
          // Initialize empty structure if needed, or just {}
          setDivisionSettings({});
        }
      } catch (err) {
        console.error("Fetch division settings error:", err);
      } finally {
        setLoadingDivisions(false);
      }
    };
    fetchDivisions();
  }, []);



  const handleEditStudent = (student) => {
    setEditingStudentId(student.id);
    setStudentName(student.name);
    setStudentEmail(student.email);
    setStudentDept(student.department);
    setStudentSemester(student.semester);
    setStudentDivision(student.division || "A");
    setStudentDOB(student.dob || "");
    setStudentFatherName(student.fatherName || "");
    setStudentMotherName(student.motherName || "");
    setStudentReligion(student.religion || "");
    setStudentCaste(student.caste || "");
    setStudentPhone(student.phone || "");
    setStudentGuardianName(student.guardianName || "");
    setStudentGuardianAddress(student.guardianAddress || "");
    setStudentTotalFees(student.totalFees || 0);
    setActiveMenu("students");
    setShowStudentForm(true);
  };

  const handleAddStudentSubmit = async (e) => {
    e.preventDefault();
    if (!studentName || !studentEmail) {
      alert("Please fill in name and email.");
      return;
    }
    try {
      const studentData = {
        name: studentName,
        email: studentEmail,
        rollNo: "", // Explicitly clear/ignore manual roll number
        department: studentDept,
        semester: studentSemester,
        division: studentDivision,
        dob: studentDOB,
        fatherName: studentFatherName,
        motherName: studentMotherName,
        religion: studentReligion,
        caste: studentCaste,
        phone: studentPhone,
        guardianName: studentGuardianName,
        guardianAddress: studentGuardianAddress,
        totalFees: Number(studentTotalFees),
        updatedAt: Date.now()
      };

      if (editingStudentId) {
        const studentRef = rtdbRef(rtdb, `students/${editingStudentId}`);
        await update(studentRef, studentData);
        alert("Student updated successfully.");
      } else {
        const studentsRef = rtdbRef(rtdb, 'students');
        const newStudentRef = push(studentsRef);
        await set(newStudentRef, { ...studentData, createdAt: Date.now() });

        const secondaryApp = initializeApp(firebaseConfig, "secondaryStudent");
        const secondaryAuth = getAuth(secondaryApp);
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, studentEmail, "12345678");
          const newUser = userCredential.user;
          await sendPasswordResetEmail(secondaryAuth, studentEmail);

          await setDoc(doc(db, "student", newUser.uid), {
            ...studentData,
            username: studentEmail, // RollNo removed, using email as username
            role: "student",
            createdAt: serverTimestamp()
          });

          await set(rtdbRef(rtdb, `users/${newUser.uid}`), {
            name: studentName,
            username: studentEmail,
            email: studentEmail,
            role: "student",
            department: studentDept,
            semester: studentSemester,
            division: studentDivision,
            createdAt: Date.now()
          });

          await set(rtdbRef(rtdb, `fees/${newUser.uid}`), {
            total: Number(studentTotalFees),
            paid: 0,
            pending: Number(studentTotalFees)
          });

          alert(`Student added successfully!\nDefault Username: ${studentEmail}\nDefault Password: 12345678\n\nA password reset email has been sent to ${studentEmail}.`);
        } catch (authErr) {
          if (authErr.code === 'auth/email-already-in-use') {
            await sendPasswordResetEmail(secondaryAuth, studentEmail);
            alert("Student data saved. User already exists, reset email sent.");
          } else {
            alert("Auth error: " + authErr.message);
          }
        } finally {
          await deleteApp(secondaryApp);
        }
      }

      const snap = await rtdbGet(rtdbRef(rtdb, 'students'));
      if (snap.exists()) {
        const data = snap.val();
        setStudentsList(Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a, b) => (a.department || "").localeCompare(b.department || "") || (a.name || "").localeCompare(b.name || "")));
      }

      setStudentName(""); setStudentEmail("");
      setStudentDivision("A"); setStudentDOB("");
      setStudentFatherName(""); setStudentMotherName("");
      setStudentReligion(""); setStudentCaste(""); setStudentPhone("");
      setStudentGuardianName(""); setStudentGuardianAddress("");
      setStudentTotalFees(0);
      setEditingStudentId(null);
      setStudentName("");
      setStudentEmail("");
      setStudentDivision("A");
      setStudentDOB("");
      setStudentFatherName("");
      setStudentMotherName("");
      setStudentReligion("");
      setStudentCaste("");
      setStudentPhone("");
      setStudentGuardianName("");
      setStudentGuardianAddress("");
      setStudentTotalFees(0);
      setEditingStudentId(null);
      setShowStudentForm(false);
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleUpdateWindowSubmit = async (e) => {
    e.preventDefault();
    try {
      const startTs = new Date(windowStart).getTime();
      const endTs = new Date(windowEnd).getTime();
      await update(rtdbRef(rtdb, 'settings/student_update_window'), {
        start: startTs,
        end: endTs
      });
      alert("Access window updated!");
      setSettings(prev => ({
        ...prev,
        student_update_window: {
          ...prev.student_update_window,
          start: startTs,
          end: endTs
        }
      }));
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleToggleUnlock = async () => {
    const nextState = !isUnlocked;
    try {
      await update(rtdbRef(rtdb, 'settings/student_update_window'), {
        isUnlocked: nextState
      });
      setIsUnlocked(nextState);
      setSettings(prev => ({
        ...prev,
        student_update_window: {
          ...prev.student_update_window,
          isUnlocked: nextState
        }
      }));
    } catch (err) {
      alert("Error toggling unlock: " + err.message);
    }
  };

  const handleAddTeacherSubmit = async (e) => {
    e.preventDefault();
    e.preventDefault();

    // Validation: Name and Email always required
    if (!teacherName || !teacherEmail) {
      alert("Please fill all required fields (Name, Email)");
      return;
    }

    // Validation: EmpID required
    if (!teacherEmpId) {
      alert("Please enter Employee ID");
      return;
    }

    try {
      // Check for duplicates (Email or EmpID) using RTDB
      if (!editingTeacherId) {
        const teachersRef = rtdbRef(rtdb, 'teachers');

        const qEmail = rtdbQuery(teachersRef, orderByChild("email"), equalTo(teacherEmail));
        const snapEmail = await rtdbGet(qEmail);
        if (snapEmail.exists()) {
          alert("A teacher with this email already exists.");
          return;
        }

        if (!isTutor) {
          const qEmp = rtdbQuery(teachersRef, orderByChild("employeeId"), equalTo(teacherEmpId));
          const snapEmp = await rtdbGet(qEmp);
          if (snapEmp.exists()) {
            alert("A teacher with this Employee ID already exists.");
            return;
          }
        }
      }

      // Check Admission Duty limit (Max 2 per department)
      if (isAdmissionDuty) {
        const teachersRef = rtdbRef(rtdb, 'teachers');
        const qDept = rtdbQuery(teachersRef, orderByChild("department"), equalTo(teacherDept));
        const snapDept = await rtdbGet(qDept);

        let currentDutyCount = 0;
        if (snapDept.exists()) {
          const data = snapDept.val();
          Object.keys(data).forEach((key) => {
            // Exclude current teacher if editing
            if (editingTeacherId && key === editingTeacherId) return;
            if (data[key].isAdmissionDuty) {
              currentDutyCount++;
            }
          });
        }

        if (currentDutyCount >= 2) {
          alert(`Limit Reached: The ${teacherDept} department already has 2 staff members assigned to Admission Duty.`);
          return;
        }
      }

      // Prepare data
      // For Tutors: Generate specific EmpID/Dept if not provided
      const teacherData = {
        name: teacherName,
        email: teacherEmail,
        employeeId: teacherEmpId,
        department: teacherDept,
        isAdmissionDuty,
        admissionDutyStartDate: isAdmissionDuty ? admissionDutyStartDate : "",
        admissionDutyEndDate: isAdmissionDuty ? admissionDutyEndDate : "",
        admissionDutyStartTime: isAdmissionDuty ? admissionDutyStartTime : "",
        admissionDutyEndTime: isAdmissionDuty ? admissionDutyEndTime : "",
        isTutor,
        tutorClassDept: isTutor ? tutorClassDept : "",
        tutorClassSem: isTutor ? tutorClassSem : "",
        tutorClassDiv: isTutor ? tutorClassDiv : "",
        updatedAt: Date.now()
      };

      if (editingTeacherId) {
        const teacherRef = rtdbRef(rtdb, `teachers/${editingTeacherId}`);
        await update(teacherRef, teacherData);

        // Also try to update the actual user profile in 'staffs' based on email
        try {
          // Manual filter to find the UID from either 'staffs' or 'users'
          let targetUid = null;

          // 1. Try finding in 'staffs'
          const staffsRef = rtdbRef(rtdb, 'staffs');
          const staffSnap = await rtdbGet(staffsRef);
          if (staffSnap.exists()) {
            const allStaff = staffSnap.val();
            targetUid = Object.keys(allStaff).find(key => allStaff[key].email === teacherEmail);
          }

          // 2. If not found, try finding in 'users'
          if (!targetUid) {
            const usersRef = rtdbRef(rtdb, 'users');
            const usersSnap = await rtdbGet(usersRef);
            if (usersSnap.exists()) {
              const allUsers = usersSnap.val();
              targetUid = Object.keys(allUsers).find(key => allUsers[key].email === teacherEmail);
            }
          }

          if (targetUid) {
            console.log("Found user/staff profile to update:", targetUid);
            const updatePayload = {
              isAdmissionDuty,
              admissionDutyStartDate: isAdmissionDuty ? admissionDutyStartDate : "",
              admissionDutyEndDate: isAdmissionDuty ? admissionDutyEndDate : "",
              admissionDutyStartTime: isAdmissionDuty ? admissionDutyStartTime : "",
              admissionDutyEndTime: isAdmissionDuty ? admissionDutyEndTime : "",
              isTutor,
              tutorClassDept: isTutor ? tutorClassDept : "",
              tutorClassSem: isTutor ? tutorClassSem : "",
              tutorClassDiv: isTutor ? tutorClassDiv : "",
              department: teacherDept,
              employeeId: teacherEmpId,
              name: teacherName,
              email: teacherEmail // Ensure email is in update payload
            };

            await update(rtdbRef(rtdb, `staffs/${targetUid}`), updatePayload);
            await update(rtdbRef(rtdb, `users/${targetUid}`), updatePayload);
            console.log("Updated both staffs and users nodes for:", targetUid);
          } else {
            console.warn("No matching user/staff profile found for email:", teacherEmail);
          }
        } catch (updateErr) {
          console.error("Error updating staff profile:", updateErr);
        }

        alert("Teacher updated successfully.");
      } else {
        // 1. Add to RTDB
        const teachersRef = rtdbRef(rtdb, 'teachers');
        const newTeacherRef = push(teachersRef);
        await set(newTeacherRef, {
          ...teacherData,
          createdAt: Date.now()
        });

        // 2. Create Firebase Auth account with default password and send reset email
        // We use a secondary app instance to avoid logging out the current admin
        const secondaryApp = initializeApp(firebaseConfig, "secondary");
        const secondaryAuth = getAuth(secondaryApp);

        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, teacherEmail, "12345678");
          const newUser = userCredential.user;

          // Send reset email
          await sendPasswordResetEmail(secondaryAuth, teacherEmail);

          // 3. Create Firestore Staff Profile (required for login check)
          await setDoc(doc(db, "staff", newUser.uid), {
            name: teacherName,
            email: teacherEmail,
            role: "staff",
            employeeId: teacherEmpId,
            department: teacherDept,
            isAdmissionDuty,
            admissionDutyStartDate: isAdmissionDuty ? admissionDutyStartDate : "",
            admissionDutyEndDate: isAdmissionDuty ? admissionDutyEndDate : "",
            admissionDutyStartTime: isAdmissionDuty ? admissionDutyStartTime : "",
            admissionDutyEndTime: isAdmissionDuty ? admissionDutyEndTime : "",
            isTutor,
            tutorClassDept: isTutor ? tutorClassDept : "",
            tutorClassSem: isTutor ? tutorClassSem : "",
            tutorClassDiv: isTutor ? tutorClassDiv : "",
            createdAt: serverTimestamp()
          });

          // 4. Create RTDB User Profile
          await set(rtdbRef(rtdb, `users/${newUser.uid}`), {
            name: teacherName,
            email: teacherEmail,
            role: "staff",
            isTutor,
            tutorClassDept: isTutor ? tutorClassDept : "",
            tutorClassSem: isTutor ? tutorClassSem : "",
            tutorClassDiv: isTutor ? tutorClassDiv : "",
            createdAt: Date.now()
          });

          // 5. Also add to staffs/ node for role-specific lookups
          await set(rtdbRef(rtdb, `staffs/${newUser.uid}`), {
            name: teacherName,
            email: teacherEmail,
            role: "staff",
            isTutor,
            tutorClassDept: isTutor ? tutorClassDept : "",
            tutorClassSem: isTutor ? tutorClassSem : "",
            tutorClassDiv: isTutor ? tutorClassDiv : "",
            createdAt: Date.now()
          });

          alert(`Teacher added! Account created with default password '12345678'. A password reset email has been sent to ${teacherEmail}.`);
        } catch (authErr) {
          if (authErr.code === 'auth/email-already-in-use') {
            // Send reset email even if user exists
            await sendPasswordResetEmail(secondaryAuth, teacherEmail);
            alert(`Teacher data saved. This email is already registered in Firebase. A password reset email has been sent to ${teacherEmail}. They can use the 'First Time Login' flow to activate.`);
          } else {
            console.error("Auth creation/email error:", authErr);
            alert(`Teacher added to database, but Auth creation failed: ${authErr.message}`);
          }
        } finally {
          await deleteApp(secondaryApp);
        }
      }

      // Reset form
      setTeacherName("");
      setTeacherEmail("");
      setTeacherEmpId("");
      setIsTutor(false);
      setTutorClassDept("Computer Science");
      setTutorClassSem("Semester 1");
      setTutorClassDiv("A");
      setIsAdmissionDuty(false);
      setAdmissionDutyStartDate("");
      setAdmissionDutyEndDate("");
      setAdmissionDutyStartTime("");
      setAdmissionDutyEndTime("");
      setEditingTeacherId(null);

      // Refresh list
      const teachersRef = rtdbRef(rtdb, 'teachers');
      const snap = await rtdbGet(teachersRef);
      if (snap.exists()) {
        const data = snap.val();
        const items = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setTeachersList(items);
      } else {
        setTeachersList([]);
      }
    } catch (err) {
      console.error("Error saving teacher:", err);
      alert("Error saving teacher: " + err.message);
    }
  };

  const handleEditTeacher = (teacher) => {
    setTeacherName(teacher.name);
    setTeacherEmail(teacher.email);
    setTeacherEmpId(teacher.employeeId);
    setTeacherDept(teacher.department);
    setIsTutor(teacher.isTutor || false);
    setTutorClassDept(teacher.tutorClassDept || teacherDept);
    setTutorClassSem(teacher.tutorClassSem || "Semester 1");
    setTutorClassDiv(teacher.tutorClassDiv || "A");
    setIsAdmissionDuty(teacher.isAdmissionDuty || false);
    setAdmissionDutyStartDate(teacher.admissionDutyStartDate || "");
    setAdmissionDutyEndDate(teacher.admissionDutyEndDate || "");
    setAdmissionDutyStartTime(teacher.admissionDutyStartTime || "");
    setAdmissionDutyEndTime(teacher.admissionDutyEndTime || "");
    setEditingTeacherId(teacher.id);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to form
  };

  const handleAddSubjectSubmit = async (e) => {
    e.preventDefault();
    if (!subjectName.trim() || !subjectCode.trim()) {
      alert("Please provide subject name and code.");
      return;
    }
    try {
      // Check if subject code already exists using RTDB
      const subjectsRef = rtdbRef(rtdb, 'subjects');
      const qCheck = rtdbQuery(subjectsRef, orderByChild("code"), equalTo(subjectCode.trim()));
      const snapCheck = await rtdbGet(qCheck);

      if (snapCheck.exists() && (!editingSubjectId || (editingSubjectId && Object.keys(snapCheck.val())[0] !== editingSubjectId))) {
        // If editing, allow same code if it belongs to current subject
        // But here key check is simplified. Better: check keys.
        // Actually, snapCheck returns object of matches. If any match ID != editingSubjectId, then duplicate.
        const matchId = Object.keys(snapCheck.val())[0];
        if (matchId !== editingSubjectId) {
          alert(`Subject code "${subjectCode.trim()}" already exists. Please use a unique code.`);
          return;
        }
      }

      const subjectData = {
        semester,
        name: subjectName.trim(),
        code: subjectCode.trim(),
        department,
        credits: Number(credits) || 0,
        teachingHours: Number(teachingHours) || 0,
        teachingHours: Number(teachingHours) || 0,
        type: subjectType,
        category: subjectCategory === "Other" ? customCategory.trim() : subjectCategory,
        scheme: subjectScheme === "Other" ? customScheme.trim() : subjectScheme,
        updatedAt: Date.now()
      };

      if (editingSubjectId) {
        // Update existing
        await update(rtdbRef(rtdb, `subjects/${editingSubjectId}`), subjectData);
        alert("Subject updated successfully.");
        setEditingSubjectId(null);
      } else {
        // Create new
        const newSubjectRef = push(subjectsRef);
        await set(newSubjectRef, {
          ...subjectData,
          createdAt: Date.now()
        });
        alert("Subject added successfully.");
      }

      // Clear fields and refetch
      setSubjectName("");
      setSubjectCode("");
      setCredits("");
      setTeachingHours("");
      setTeachingHours("");
      setSubjectType("Theory");
      setSubjectCategory("Core");
      setSubjectScheme(schemes[schemes.length - 1]);
      setCustomScheme("");
      setCustomCategory("");
      setSubjectScheme(schemes[schemes.length - 1]);

      // Refresh list (re-fetch)
      const q = rtdbQuery(subjectsRef, orderByChild('semester'), equalTo(semester));
      const snap = await rtdbGet(q);
      if (snap.exists()) {
        const data = snap.val();
        const items = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setSubjectsList(items);
      } else {
        setSubjectsList([]);
      }

    } catch (err) {
      console.error("Add/Update subject error:", err);
      alert(`Error: ${err.message || err}`);
    }
  };

  const handleAutoGenerate = async () => {
    if (!selectedDept || !selectedSemester || selectedDept === 'All') {
      alert("Please select a specific Department and Semester first (cannot auto-generate for 'All').");
      return;
    }

    if (!window.confirm(`Auto-generate timetable for ${selectedDept} - ${selectedSemester}? This will overwrite existing data.`)) {
      return;
    }

    try {
      console.log("Fetching subjects for Dept:", selectedDept);

      // 1. Fetch Subjects - Client-side filtering to bypass "Index not defined" error
      const subjectsRef = rtdbRef(rtdb, 'subjects');
      const subSnap = await rtdbGet(subjectsRef);
      console.log("Subject Snapshot Exists:", subSnap.exists());

      if (!subSnap.exists()) {
        alert("No subjects found in the database. Add subjects first.");
        return;
      }

      const allSubjects = subSnap.val();
      const subjects = Object.keys(allSubjects)
        .map(key => ({
          id: key,
          ...allSubjects[key],
          credits: parseInt(allSubjects[key].credits || 3),
          teachingHours: parseInt(allSubjects[key].teachingHours || allSubjects[key].credits || 3)
        }))
        .filter(s => s.department === selectedDept && s.semester === selectedSemester);

      console.log("Filtered Subjects:", subjects);

      if (subjects.length === 0) {
        alert(`No subjects found for ${selectedDept} - ${selectedSemester}.`);
        return;
      }

      // 2. Fetch All Teachers
      const teachersRef = rtdbRef(rtdb, 'teachers');
      const teachSnap = await rtdbGet(teachersRef);
      if (!teachSnap.exists()) {
        alert("No teachers found. Add teachers first.");
        return;
      }
      const allTeachersData = teachSnap.val();
      const teachers = Object.keys(allTeachersData).map(key => ({ id: key, ...allTeachersData[key] }));
      console.log(`Fetched ${teachers.length} teachers.`);

      // 2.5 Fetch Preferences
      const prefsRef = rtdbRef(rtdb, 'preferences');
      const prefSnap = await rtdbGet(prefsRef);
      let preferences = [];
      if (prefSnap.exists()) {
        const pData = prefSnap.val();
        preferences = Object.keys(pData).map(k => ({ id: k, ...pData[k] }));
        console.log(`Fetched ${preferences.length} preferences.`);
      }

      // Pre-Verification: Check if any subjects exist for the selected Class
      const relevantSubjects = subjects.filter(s => s.department === selectedDept && s.semester === selectedSemester);
      if (relevantSubjects.length === 0) {
        alert(`No subjects found for ${selectedDept} - ${selectedSemester}. Please add subjects first!`);
        return;
      }
      console.log(`Found ${relevantSubjects.length} subjects for ${selectedDept} - ${selectedSemester}:`, relevantSubjects.map(s => s.name));

      // 2.7 Fetch Existing Timetables for Cross-Semester/Dept Checking
      const timetablesRef = rtdbRef(rtdb, 'timetables');
      const ttSnap = await rtdbGet(timetablesRef);
      const existingTimetables = ttSnap.exists() ? ttSnap.val() : {};
      console.log(`Fetched existing timetables for conflict checking.`);

      // 3. Run Generator
      const count = divisionSettings[selectedDept]?.[selectedSemester] || 1;
      const divisions = Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
      console.log(`Generating for ${count} divisions:`, divisions);

      // Pass preferences AND existing timetables to the generator
      const generator = new TimetableGenerator(relevantSubjects, teachers, preferences, existingTimetables);

      const methodResult = generator.generate(divisions);
      // Result structure: { Dept: { Sem: { Div: { Day: { Hour: Slot } } } } }

      const generatedSchedule = methodResult[selectedDept] && methodResult[selectedDept][selectedSemester]
        ? methodResult[selectedDept][selectedSemester]
        : null;

      if (!generatedSchedule) {
        alert("Generation failed. Please check console for details.");
        return;
      }

      // Verify if any slots were actually filled
      let totalSlots = 0;
      Object.keys(generatedSchedule).forEach(div => {
        if (generatedSchedule[div]) {
          Object.keys(generatedSchedule[div]).forEach(day => {
            totalSlots += Object.keys(generatedSchedule[div][day]).length;
          });
        }
      });

      if (totalSlots === 0) {
        const debugMsg = generator.debugInfo ? generator.debugInfo.join('\n') : "No debug info";
        console.error("Generation Failed Reasons:", debugMsg);
        prompt("Generation Failed. Please COPY these reasons and paste them to the chat:", debugMsg);
        return;
      }

      // 4. Save to DB
      // generatedSchedule is { A: {...}, B: {...} }
      const timetableRef = rtdbRef(rtdb, `timetables/${selectedDept}/${selectedSemester}`);
      await set(timetableRef, generatedSchedule);

      alert(`Timetable generated successfully for ${count} division(s)! (${totalSlots} slots created)`);

      // Refresh View - Set data for CURRENT selected division
      const currentDivData = generatedSchedule[selectedDivision || 'A'];
      setTimetableData(currentDivData || {});
    } catch (err) {
      console.error("Auto-generation error:", err);
      alert("Error during auto-generation: " + err.message);
    }
  };

  const handleBulkGenerate = async (type) => {
    if (!selectedDept || selectedDept === 'All') {
      alert("Please select a specific Department first.");
      return;
    }

    const sems = type === 'odd' ? [1, 3, 5, 7] : [2, 4, 6, 8];
    const semNames = sems.map(s => `Semester ${s}`);

    if (!window.confirm(`Auto-generate timetable for ${selectedDept} - ${type.toUpperCase()} Semesters (${semNames.join(', ')})? This will overwrite existing data for these semesters.`)) {
      return;
    }

    try {
      console.log(`Fetching subjects for Dept: ${selectedDept}, Type: ${type}`);

      const subjectsRef = rtdbRef(rtdb, 'subjects');
      const subSnap = await rtdbGet(subjectsRef);

      if (!subSnap.exists()) {
        alert("No subjects found in the database. Add subjects first.");
        return;
      }

      const allSubjects = subSnap.val();
      const subjects = Object.keys(allSubjects)
        .map(key => ({
          id: key,
          ...allSubjects[key],
          credits: parseInt(allSubjects[key].credits || 3),
          teachingHours: parseInt(allSubjects[key].teachingHours || allSubjects[key].credits || 3)
        }))
        .filter(s => s.department === selectedDept && semNames.includes(s.semester));

      if (subjects.length === 0) {
        alert(`No subjects found for ${selectedDept} - ${type} semesters.`);
        return;
      }

      const teachersRef = rtdbRef(rtdb, 'teachers');
      const teachSnap = await rtdbGet(teachersRef);
      if (!teachSnap.exists()) {
        alert("No teachers found. Add teachers first.");
        return;
      }
      const allTeachersData = teachSnap.val();
      const teachers = Object.keys(allTeachersData).map(key => ({ id: key, ...allTeachersData[key] }));

      const prefsRef = rtdbRef(rtdb, 'preferences');
      const prefSnap = await rtdbGet(prefsRef);
      let preferences = [];
      if (prefSnap.exists()) {
        const pData = prefSnap.val();
        preferences = Object.keys(pData).map(k => ({ id: k, ...pData[k] }));
      }

      const timetablesRef = rtdbRef(rtdb, 'timetables');
      const ttSnap = await rtdbGet(timetablesRef);
      const existingTimetables = ttSnap.exists() ? ttSnap.val() : {};

      // Prepare division objects
      const divisionsPerSem = {};
      semNames.forEach(sem => {
        const count = divisionSettings[selectedDept]?.[sem] || 1;
        divisionsPerSem[sem] = Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
      });

      const generator = new TimetableGenerator(subjects, teachers, preferences, existingTimetables);
      const methodResult = generator.generate(divisionsPerSem);

      const generatedDeptSchedule = methodResult[selectedDept];

      if (!generatedDeptSchedule) {
        alert("Generation failed. Please check console for details.");
        return;
      }

      let totalSlots = 0;
      let scheduledSems = [];

      // Save to DB per semester
      for (const sem of semNames) {
        if (generatedDeptSchedule[sem]) {
          const timetableRef = rtdbRef(rtdb, `timetables/${selectedDept}/${sem}`);
          await set(timetableRef, generatedDeptSchedule[sem]);

          // Count slots
          Object.keys(generatedDeptSchedule[sem]).forEach(div => {
            if (generatedDeptSchedule[sem][div]) {
              Object.keys(generatedDeptSchedule[sem][div]).forEach(day => {
                totalSlots += Object.keys(generatedDeptSchedule[sem][div][day]).length;
              });
            }
          });
          scheduledSems.push(sem);
        }
      }

      if (totalSlots === 0) {
        const debugMsg = generator.debugInfo ? generator.debugInfo.join('\n') : "No debug info";
        prompt("Generation Failed. Please COPY these reasons and paste them to the chat:", debugMsg);
        return;
      }

      alert(`Timetables generated successfully for ${scheduledSems.join(', ')}! (${totalSlots} slots created)`);

      // Refresh view if the current selected semester is in the generated ones
      if (scheduledSems.includes(selectedSemester)) {
        const currentDivData = generatedDeptSchedule[selectedSemester][selectedDivision || 'A'];
        setTimetableData(currentDivData || {});
      }

    } catch (err) {
      console.error("Bulk auto-generation error:", err);
      alert("Error during bulk generation: " + err.message);
    }
  };

  const handleClearTimetable = async () => {
    if (!selectedDept || selectedDept === 'All' || !selectedSemester) {
      alert("Please select a specific Department and Semester first.");
      return;
    }

    if (!window.confirm(`Are you sure you want to completely CLEAR the timetable for ${selectedDept} - ${selectedSemester}? This action cannot be undone.`)) {
      return;
    }

    try {
      const timetableRef = rtdbRef(rtdb, `timetables/${selectedDept}/${selectedSemester}`);
      await set(timetableRef, null);

      setTimetableData({});
      alert("Timetable cleared successfully.");
    } catch (err) {
      console.error("Clear timetable error:", err);
      alert("Error clearing timetable: " + err.message);
    }
  };


  const handleEditSubject = (subject) => {
    setEditingSubjectId(subject.id);
    setSubjectName(subject.name);
    setSubjectCode(subject.code);
    setDepartment(subject.department);
    setSemester(subject.semester);
    setCredits(subject.credits);
    setTeachingHours(subject.teachingHours);
    setSubjectType(subject.type || "Theory");
    const cat = subject.category || "Core";
    if (categories.includes(cat)) {
      setSubjectCategory(cat);
      setCustomCategory("");
    } else {
      setSubjectCategory("Other");
      setCustomCategory(cat);
    }
    const sch = subject.scheme || schemes[schemes.length - 1];
    if (schemes.includes(sch)) {
      setSubjectScheme(sch);
      setCustomScheme("");
    } else {
      setSubjectScheme("Other");
      setCustomScheme(sch);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSubject = async (id) => {
    if (!window.confirm("Are you sure you want to delete this subject?")) return;
    try {
      await remove(rtdbRef(rtdb, `subjects/${id}`));
      // Refresh list
      const q = rtdbQuery(rtdbRef(rtdb, 'subjects'), orderByChild('semester'), equalTo(semester));
      const snap = await rtdbGet(q);
      if (snap.exists()) {
        const data = snap.val();
        const items = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setSubjectsList(items);
      } else {
        setSubjectsList([]);
      }
      alert("Subject deleted.");
    } catch (err) {
      console.error("Delete subject error:", err);
      alert("Error deleting subject: " + err.message);
    }
  };

  const handleSlotClick = (day, hour) => {
    const existingSlot = timetableData[day] ? timetableData[day][hour] : null;
    if (existingSlot) {
      setSubject(existingSlot.subject);
      setTeacher(existingSlot.teacherEmpId); // Store ID/EmpID
      setRoom(existingSlot.room);
    } else {
      setSubject("");
      setTeacher("");
      setRoom("");
    }
    setCurrentSlot({ day, hour });
    setShowForm(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const { day, hour } = currentSlot;
      const div = selectedDivision || 'A';
      const timetableRef = rtdbRef(rtdb, `timetables/${selectedDept}/${selectedSemester}/${div}/${day}/${hour}`);

      if (!subject) {
        // Delete slot if subject is cleared
        await set(timetableRef, null);
      } else {
        const teacherObj = teachersList.find(t => t.employeeId === teacher);
        await set(timetableRef, {
          subject,
          teacherEmpId: teacher,
          teacherName: teacherObj ? teacherObj.name : teacher,
          room,
          department: selectedDept,
          semester: selectedSemester,
          division: div,
          updatedAt: Date.now()
        });
      }

      // Refresh timetable data
      const updatedSnap = await rtdbGet(rtdbRef(rtdb, `timetables/${selectedDept}/${selectedSemester}/${div}`));
      setTimetableData(updatedSnap.exists() ? updatedSnap.val() : {});

      setShowForm(false);
      setCurrentSlot(null);
    } catch (err) {
      console.error("Save timetable error:", err);
      alert("Error saving timetable slot: " + err.message);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setCurrentSlot(null);
    setSubject("");
    setTeacher("");
    setRoom("");
  };

  const handleDeleteTeacher = async () => {
    if (!editingTeacherId) return;
    if (!window.confirm("Are you sure you want to delete this teacher?")) return;
    try {
      await remove(rtdbRef(rtdb, `teachers/${editingTeacherId}`));
      alert("Teacher deleted successfully.");
      setEditingTeacherId(null);
      setTeacherName("");
      setTeacherEmail("");
      setTeacherEmpId("");
      setTeacherDept("Computer Science"); // Reset to default if needed, or keep existing
      setIsTutor(false);
      setTutorClassDept("Computer Science");
      setTutorClassSem("Semester 1");
      setTutorClassDiv("A");
      setIsAdmissionDuty(false);

      const teachersRef = rtdbRef(rtdb, 'teachers');
      const snap = await rtdbGet(teachersRef);
      if (snap.exists()) {
        const data = snap.val();
        const items = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setTeachersList(items);
      } else {
        setTeachersList([]);
      }
    } catch (err) {
      alert("Error deleting teacher: " + err.message);
    }
  };

  const handleDeleteStudent = async () => {
    if (!editingStudentId) return;
    if (!window.confirm("Are you sure you want to delete this student?")) return;
    try {
      if (editingStudentId) {
        await remove(rtdbRef(rtdb, `students/${editingStudentId}`));
        alert("Student deleted successfully.");
      }

      setEditingStudentId(null);
      setStudentName("");
      setStudentEmail("");
      setStudentDept("CSE");
      setStudentSemester("1");
      setStudentDivision("A");
      setStudentDOB("");
      setStudentFatherName("");
      setStudentMotherName("");
      setStudentReligion("");
      setStudentCaste("");
      setStudentPhone("");
      setStudentGuardianName("");
      setStudentGuardianAddress("");
      setStudentTotalFees(0);

      const snap = await rtdbGet(rtdbRef(rtdb, 'students'));
      if (snap.exists()) {
        const data = snap.val();
        setStudentsList(Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a, b) => (a.department || "").localeCompare(b.department || "") || (a.name || "").localeCompare(b.name || "")));
      } else {
        setStudentsList([]);
      }
    } catch (err) {
      alert("Error deleting student: " + err.message);
    }
  };

  const handleGenerateRegisterNumbers = async () => {
    if (!window.confirm("This will generate/overwrite register numbers for ALL students. This might take a moment. Continue?")) return;

    setLoadingStudents(true);
    try {
      const grouped = {};
      // Group by department
      studentsList.forEach(s => {
        const dept = s.department || "Unassigned";
        if (!grouped[dept]) grouped[dept] = [];
        grouped[dept].push(s);
      });

      let successCount = 0;
      let errorCount = 0;

      for (const dept of Object.keys(grouped)) {
        const deptCode = deptCodes[dept] || "XX";
        const sorted = grouped[dept].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        for (let i = 0; i < sorted.length; i++) {
          const student = sorted[i];
          const sequenceNum = (i + 1).toString().padStart(3, '0');
          const registerNo = `${collegeCode}${admissionYear}${deptCode}${sequenceNum}`;

          try {
            // Update student record
            await update(rtdbRef(rtdb, `students/${student.id}`), { registerNo });
            // Update user record
            await update(rtdbRef(rtdb, `users/${student.id}`), { registerNo });
            successCount++;
          } catch (itemErr) {
            console.error(`Failed to update student ${student.id}:`, itemErr);
            errorCount++;
          }
        }
      }

      alert(`Process Complete!\n\nSuccessfully updated: ${successCount} students\nErrors encountered: ${errorCount}`);

      // Refresh list
      const snap = await rtdbGet(rtdbRef(rtdb, 'students'));
      if (snap.exists()) {
        const data = snap.val();
        setStudentsList(Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a, b) => (a.department || "").localeCompare(b.department || "") || (a.name || "").localeCompare(b.name || "")));
      }
    } catch (err) {
      alert("Critical Error: " + err.message);
    } finally {
      setLoadingStudents(false);
    }
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <h2 className="admin-logo">Schedulix Admin</h2>

        <ul className="admin-menu">
          <li
            className={activeMenu === "overview" ? "active" : ""}
            onClick={() => setActiveMenu("overview")}
          >
            <LayoutDashboard size={20} className="menu-icon" /> Overview
          </li>
          <li
            className={activeMenu === "preferences" ? "active" : ""}
            onClick={() => setActiveMenu("preferences")}
          >
            <ClipboardList size={20} className="menu-icon" /> Subject Preferences
          </li>
          <li
            className={activeMenu === "class-timetable" ? "active" : ""}
            onClick={() => setActiveMenu("class-timetable")}
          >
            <Calendar size={20} className="menu-icon" /> Class Timetables
          </li>
          <li
            className={activeMenu === "teacher-timetable" ? "active" : ""}
            onClick={() => setActiveMenu("teacher-timetable")}
          >
            <Clock size={20} className="menu-icon" /> Teacher Timetables
          </li>
          <li
            className={activeMenu === "master-timetable" ? "active" : ""}
            onClick={() => setActiveMenu("master-timetable")}
          >
            <ClipboardList size={20} className="menu-icon" /> Master Timetable
          </li>
          <li
            className={activeMenu === "add-subject" ? "active" : ""}
            onClick={() => setActiveMenu("add-subject")}
          >
            <PlusCircle size={20} className="menu-icon" /> Add Subject
          </li>
          <li
            className={activeMenu === "teachers" ? "active" : ""}
            onClick={() => setActiveMenu("teachers")}
          >
            <GraduationCap size={20} className="menu-icon" /> Teachers
          </li>
          <li
            className={activeMenu === "students" ? "active" : ""}
            onClick={() => setActiveMenu("students")}
          >
            <Users size={20} className="menu-icon" /> Students
          </li>
          <li
            className={activeMenu === "settings" ? "active" : ""}
            onClick={() => setActiveMenu("settings")}
          >
            <Clock size={20} className="menu-icon" /> Access Window
          </li>
          <li
            className={activeMenu === "users" ? "active" : ""}
            onClick={() => setActiveMenu("users")}
          >
            <Users size={20} className="menu-icon" /> All Users
          </li>
          <li
            className={activeMenu === "division-settings" ? "active" : ""}
            onClick={() => setActiveMenu("division-settings")}
          >
            <LayoutDashboard size={20} className="menu-icon" /> Division Settings
          </li>
        </ul>
        <button onClick={handleSignOut} className="sign-out-btn">
          Sign Out
        </button>

      </aside>

      {/* Main Content */}
      <main className="admin-content">
        {activeMenu === 'overview' && (
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#94a3b8' }}>Welcome, {user?.name || 'Admin'}</h2>
            <button onClick={handleSignOut} className="sign-out-btn" style={{ marginTop: 0, borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}>
              Sign Out
            </button>
          </header>
        )}

        {activeMenu === "overview" && (
          <div className="overview-section">
            <h1>Admin Dashboard</h1>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Classes</h3>
                <p>{classes.length}</p>
              </div>
              <div className="stat-card">
                <h3>Total Teachers</h3>
                <p>{teachers.length}</p>
              </div>
              <div className="stat-card">
                <h3>Scheduled Classes</h3>
                <p>{Object.keys(timetableData).length}</p>
              </div>
              <div className="stat-card">
                <h3>Available Slots</h3>
                <p>{classes.length * days.length * hours.length - Object.keys(timetableData).length}</p>
              </div>
            </div>
          </div>
        )}

        {(activeMenu === "class-timetable" || activeMenu === "teacher-timetable" || activeMenu === "master-timetable") && (
          <div className="timetable-section">
            <h1>
              {activeMenu === "class-timetable" ? "Class Timetables" :
                activeMenu === "teacher-timetable" ? "Teacher Timetables" :
                  "Master Timetable"}
            </h1>

            <div className="selector-section">
              {activeMenu === 'class-timetable' ? (
                <>
                  <div className="selector">
                    <label>Department:</label>
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                    >
                      {departments.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="selector">
                    <label>Semester:</label>
                    <select
                      value={selectedSemester}
                      onChange={(e) => setSelectedSemester(e.target.value)}
                    >
                      {Array.from({ length: 8 }, (_, i) => `Semester ${i + 1}`).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {divisionSettings[selectedDept] && divisionSettings[selectedDept][selectedSemester] > 1 && (
                    <div className="selector">
                      <label>Division:</label>
                      <select
                        value={selectedDivision}
                        onChange={(e) => setSelectedDivision(e.target.value)}
                      >
                        {Array.from({ length: divisionSettings[selectedDept][selectedSemester] }, (_, i) => String.fromCharCode(65 + i)).map(div => (
                          <option key={div} value={div}>Division {div}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', paddingLeft: '20px' }}>
                    <button
                      onClick={handleAutoGenerate}
                      className="save-btn"
                      style={{ background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.85rem' }}
                    >
                      <Calendar size={16} /> Gen Current
                    </button>
                    <button
                      onClick={() => handleBulkGenerate('odd')}
                      className="save-btn"
                      style={{ background: 'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.85rem' }}
                    >
                      <LayoutDashboard size={16} /> Gen Odd Sems
                    </button>
                    <button
                      onClick={() => handleBulkGenerate('even')}
                      className="save-btn"
                      style={{ background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.85rem' }}
                    >
                      <LayoutDashboard size={16} /> Gen Even Sems
                    </button>
                    <button
                      onClick={handleClearTimetable}
                      className="save-btn"
                      style={{ background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.85rem' }}
                    >
                      <Clock size={16} /> Clear
                    </button>
                  </div>
                </>
              ) : activeMenu === 'teacher-timetable' ? (
                <div className="selector">
                  <label>Select Teacher:</label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                  >
                    <option value="">-- Select Teacher --</option>
                    {teachersList.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.employeeId})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="selector">
                  <label>Department Filter (Optional):</label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                  >
                    <option value="All">All Departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>




            {activeMenu === 'master-timetable' ? (
              <div className="master-timetable-container" style={{ overflowX: 'auto', maxWidth: '100%' }}>
                <table className="admin-timetable" style={{ minWidth: '2000px' }}>
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', left: 0, zIndex: 10, background: '#1e293b' }}>Teacher</th>
                      {days.map(day => (
                        <th key={day} colSpan={hours.length} style={{ textAlign: 'center', borderLeft: '2px solid #334155' }}>
                          {day}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <th style={{ position: 'sticky', left: 0, zIndex: 10, background: '#1e293b' }}></th>
                      {days.map(day => (
                        hours.map(hour => (
                          <th key={`${day}-${hour}`} style={{ fontSize: '0.7em', padding: '5px', minWidth: '80px' }}>
                            {hour}
                          </th>
                        ))
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teachersList
                      .filter(t => selectedDept === 'All' || t.department === selectedDept)
                      .map(teacher => (
                        <tr key={teacher.id}>
                          <td style={{ position: 'sticky', left: 0, zIndex: 5, background: '#1e293b', fontWeight: 'bold' }}>
                            {teacher.name}
                          </td>
                          {days.map(day => (
                            hours.map(hour => {
                              const teacherSchedule = masterTimetableData[teacher.id];
                              const slot = teacherSchedule && teacherSchedule[day] ? teacherSchedule[day][hour] : null;
                              return (
                                <td key={`${teacher.id}-${day}-${hour}`} style={{ fontSize: '0.75rem', padding: '4px', height: '60px' }}>
                                  {slot ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{slot.subject}</span>
                                      <span style={{ opacity: 0.7 }}>{slot.dept.split(' ').map(w => w[0]).join('')}-{slot.sem.replace('Semester ', 'S')}</span>
                                      <span style={{ opacity: 0.5, fontSize: '0.7em' }}>{slot.room}</span>
                                    </div>
                                  ) : (
                                    <span>-</span>
                                  )}
                                </td>
                              );
                            })
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <table className="admin-timetable">
                <thead>
                  <tr>
                    <th>Time</th>
                    {days.map((day) => (
                      <th key={day}>{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hours.map((hour) => (
                    <tr key={hour}>
                      <td>{hour}</td>
                      {days.map((day) => {
                        const classInfo = timetableData[day] ? timetableData[day][hour] : null;
                        return (
                          <td
                            key={`${day}-${hour}`}
                            onClick={() => handleSlotClick(day, hour)}
                            className="timetable-cell"
                          >
                            {classInfo ? (
                              <div className="class-info">
                                <div className="subject">{classInfo.subject}</div>
                                {activeMenu === 'class-timetable' && <div className="teacher">{classInfo.teacherName}</div>}
                                {activeMenu === 'teacher-timetable' && <div className="teacher" style={{ color: '#fff' }}>{classInfo.dept} - {classInfo.sem}</div>}
                                <div className="room">{classInfo.room}</div>
                              </div>
                            ) : (
                              <span className="slot">+</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {showForm && (
              <div className="form-overlay">
                <div className="form-container">
                  <h2>Add/Edit Class</h2>
                  <form onSubmit={handleFormSubmit}>
                    <div className="form-group">
                      <label>Subject:</label>
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        required
                      >
                        <option value="">Select Subject</option>
                        {availableSubjects.map(s => (
                          <option key={s.id} value={s.name}>{s.name} ({s.code})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Teacher:</label>
                      <select
                        value={teacher}
                        onChange={(e) => {
                          setTeacher(e.target.value);
                          // Ensure email is explicitly handled if missing, assuming teacherRecord or finalUser context
                          // This part of the instruction is abstract, so applying it as a comment for clarity.
                          // If there's a specific teacher object to merge, it would be done here.
                          // Example:
                          // const selectedTeacher = teachersList.find(t => t.employeeId === e.target.value);
                          // if (selectedTeacher && !selectedTeacher.email) {
                          //   // Logic to fetch or set email if missing for the selected teacher
                          // }
                        }}
                        required
                      >
                        <option value="">Select Teacher</option>
                        {teachersList.map(t => (
                          <option key={t.id} value={t.employeeId}>{t.name} ({t.employeeId})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Room:</label>
                      <input
                        type="text"
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        placeholder="Enter room"
                      />
                    </div>
                    <div className="form-buttons">
                      <button type="submit">Save</button>
                      <button type="button" onClick={handleCancel}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeMenu === "add-subject" && (
          <div className="add-subject-section">
            <h1>{editingSubjectId ? "Edit Subject" : "Add Subject"}</h1>
            <div className="form-container" style={{ maxWidth: '700px' }}>
              <form onSubmit={handleAddSubjectSubmit}>
                {/* Row 1: Context (Dept & Semester) */}
                <div className="form-row cols-2">
                  <div className="form-group">
                    <label>Department</label>
                    <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Semester</label>
                    <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                      {Array.from({ length: 8 }, (_, i) => `Semester ${i + 1}`).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 2: Identity (Name & Code) */}
                <div className="form-row cols-7-3">
                  <div className="form-group">
                    <label>Subject Name</label>
                    <input type="text" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="e.g. Data Structures" />
                  </div>
                  <div className="form-group">
                    <label>Subject Code</label>
                    <input type="text" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} placeholder="e.g. CS101" />
                  </div>
                </div>

                {/* Row 3: Details (Type, Credits, Hours) */}
                <div className="form-row cols-3">
                  <div className="form-group">
                    <label>Type</label>
                    <select value={subjectType} onChange={(e) => setSubjectType(e.target.value)}>
                      <option value="Theory">Theory</option>
                      <option value="Lab">Lab</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Credits</label>
                    <input type="number" min="0" value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="Credits" />
                  </div>
                  <div className="form-group">
                    <label>Teaching Hours</label>
                    <input type="number" min="0" value={teachingHours} onChange={(e) => setTeachingHours(e.target.value)} placeholder="Hours" />
                  </div>
                </div>

                {/* Row 4: Scheme & Category */}
                <div className="form-row cols-2">
                  <div className="form-group">
                    <label>Scheme</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <select value={subjectScheme} onChange={(e) => setSubjectScheme(e.target.value)} style={{ flex: 1 }}>
                        {schemes.map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="Other">Other</option>
                      </select>
                      {subjectScheme === "Other" && (
                        <input
                          type="text"
                          value={customScheme}
                          onChange={(e) => setCustomScheme(e.target.value)}
                          placeholder="Enter Scheme"
                          style={{ flex: 1 }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <select value={subjectCategory} onChange={(e) => setSubjectCategory(e.target.value)} style={{ flex: 1 }}>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="Other">Other</option>
                      </select>
                      {subjectCategory === "Other" && (
                        <input
                          type="text"
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          placeholder="Enter Category"
                          style={{ flex: 1 }}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <div className="form-buttons">
                  <button type="submit">{editingSubjectId ? "Update Subject" : "Add Subject"}</button>
                  <button type="button" onClick={() => {
                    setSubjectName(''); setSubjectCode(''); setCredits(''); setTeachingHours(''); setSubjectType('Theory');
                    setSubjectCategory('Core');
                    setSubjectScheme(schemes[schemes.length - 1]);
                    setCustomScheme("");
                    setCustomCategory("");
                    setEditingSubjectId(null);
                  }}>
                    {editingSubjectId ? "Cancel Edit" : "Clear"}
                  </button>
                </div>
              </form>
            </div>

            <div style={{ marginTop: 20 }}>
              <h2>Subjects in {semester}</h2>
              {loadingSubjects ? <p>Loading...</p> : subjectsList.length === 0 ? <p>No subjects for this semester.</p> : (
                <table className="subjects-table">
                  <thead>
                    <tr><th>Code</th><th>Name</th><th>Department</th><th>Category</th><th>Type</th><th>Credits</th><th>Hours</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {subjectsList.map(s => (
                      <tr key={s.id}>
                        <td>{s.code}</td>
                        <td>{s.name}</td>
                        <td>{s.department || ''}</td>
                        <td>{s.category || 'Core'}</td>
                        <td>{s.type || 'Theory'}</td>
                        <td>{s.credits}</td>
                        <td>{s.teachingHours}</td>
                        <td>
                          <button onClick={() => handleEditSubject(s)} className="edit-btn" style={{ marginRight: '10px' }}>Edit</button>
                          <button onClick={() => handleDeleteSubject(s.id)} className="edit-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeMenu === "teachers" && (
          <div className="add-subject-section">
            <h1>Teacher Management</h1>
            <div className="form-container" style={{ maxWidth: '700px' }}>
              <h2>{editingTeacherId ? "Edit Teacher" : "Add New Teacher"}</h2>
              <form onSubmit={handleAddTeacherSubmit}>
                <div className="form-row">
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ marginBottom: 0 }}>Tutor</label>
                    <input
                      type="checkbox"
                      checked={isTutor}
                      onChange={(e) => setIsTutor(e.target.checked)}
                      style={{ width: '20px', height: '20px' }}
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ marginBottom: 0 }}>Admission Duty</label>
                    <input
                      type="checkbox"
                      checked={isAdmissionDuty}
                      onChange={(e) => setIsAdmissionDuty(e.target.checked)}
                      style={{ width: '20px', height: '20px' }}
                    />
                  </div>
                  {isTutor && (
                    <div className="form-row" style={{ marginTop: '15px' }}>
                      <div className="form-group">
                        <label>Tutor Department</label>
                        <select value={tutorClassDept} onChange={(e) => setTutorClassDept(e.target.value)}>
                          {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Tutor Semester</label>
                        <select value={tutorClassSem} onChange={(e) => setTutorClassSem(e.target.value)}>
                          {Array.from({ length: 8 }, (_, i) => `Semester ${i + 1}`).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Tutor Division</label>
                        <select value={tutorClassDiv} onChange={(e) => setTutorClassDiv(e.target.value)}>
                          {['A', 'B', 'C', 'D'].map(d => <option key={d} value={d}>Section {d}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {isAdmissionDuty && (
                  <div className="form-row" style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', marginBottom: '15px', background: '#f9f9f9' }}>
                    <div className="form-group">
                      <label>Admission Duty Duration</label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input type="date" value={admissionDutyStartDate} onChange={(e) => setAdmissionDutyStartDate(e.target.value)} />
                        <span>to</span>
                        <input type="date" value={admissionDutyEndDate} onChange={(e) => setAdmissionDutyEndDate(e.target.value)} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Daily Work Period</label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input type="time" value={admissionDutyStartTime} onChange={(e) => setAdmissionDutyStartTime(e.target.value)} />
                        <span>to</span>
                        <input type="time" value={admissionDutyEndTime} onChange={(e) => setAdmissionDutyEndTime(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Name</label>
                    <input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="Full Name" />
                  </div>
                  <div className="form-group">
                    <label>Employee ID</label>
                    <input value={teacherEmpId} onChange={(e) => setTeacherEmpId(e.target.value)} placeholder="EMP-123" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={teacherEmail} onChange={(e) => setTeacherEmail(e.target.value)} placeholder="email@school.com" />
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <select value={teacherDept} onChange={(e) => setTeacherDept(e.target.value)}>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-buttons">
                  <button type="submit">{editingTeacherId ? "Update Teacher" : "Add Teacher"}</button>
                  {editingTeacherId && (
                    <button type="button" onClick={() => {
                      setEditingTeacherId(null);
                      setTeacherName("");
                      setTeacherEmail("");
                      setTeacherEmpId("");

                      setIsTutor(false);
                      setTutorClassDept("Computer Science");
                      setTutorClassSem("Semester 1");
                      setTutorClassDiv("A");
                      setIsAdmissionDuty(false);
                      setAdmissionDutyStartDate("");
                      setAdmissionDutyEndDate("");
                      setAdmissionDutyStartTime("");
                      setAdmissionDutyEndTime("");
                    }}>Cancel Edit</button>
                  )}
                  {editingTeacherId && (
                    <button type="button" onClick={handleDeleteTeacher} style={{ marginLeft: '10px', background: '#dc3545', color: 'white' }}>Delete</button>
                  )}
                </div>
              </form>
            </div>

            <div style={{ marginTop: 30 }}>
              <h2>All Teachers</h2>
              {loadingTeachers ? <p>Loading...</p> : (
                <table className="subjects-table">
                  <thead>
                    <tr><th>ID</th><th>Name</th><th>Email</th><th>Dept</th><th>Tutor?</th><th>Class</th><th>Adm. Duty?</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {teachersList.map(t => (
                      <tr key={t.id}>
                        <td>{t.employeeId}</td>
                        <td>{t.name}</td>
                        <td>{t.email}</td>
                        <td>{t.department}</td>
                        <td>{t.isTutor ? "Yes" : "No"}</td>
                        <td>{t.isTutor ? `${t.tutorClassDept} - ${t.tutorClassSem} (${tutorClassDiv})` : "-"}</td>
                        <td>{t.isAdmissionDuty ? "Yes" : "No"}</td>
                        <td>
                          <button onClick={() => handleEditTeacher(t)} className="edit-btn" style={{ marginRight: '10px' }}>Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeMenu === "preferences" && (
          <div className="preferences-section">
            <h1>Submitted Subject Preferences</h1>
            {loadingPreferences ? <p>Loading...</p> : preferencesList.length === 0 ? <p>No preferences submitted yet.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="subjects-table">
                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Dept</th>
                      <th>Sem</th>
                      <th>Subject Prefs</th>
                      <th>Class Prefs</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preferencesList.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 'bold' }}>{p.teacherName}</div>
                          <div style={{ fontSize: '0.85em', color: '#666' }}>{p.teacherEmpId}</div>
                        </td>
                        <td>{p.department}</td>
                        <td>{p.semester}</td>
                        <td>
                          <ol style={{ paddingLeft: '20px', margin: 0 }}>
                            {p.subjectPref1 && <li>{p.subjectPref1}</li>}
                            {p.subjectPref2 && <li>{p.subjectPref2}</li>}
                            {p.subjectPref3 && <li>{p.subjectPref3}</li>}
                          </ol>
                        </td>
                        <td>
                          <ul style={{ paddingLeft: '20px', margin: 0 }}>
                            {p.classPref1 && <li>{p.classPref1}</li>}
                            {p.classPref2 && <li>{p.classPref2}</li>}
                            {p.classPref3 && <li>{p.classPref3}</li>}
                          </ul>
                        </td>
                        <td>
                          {p.createdAt ? (p.createdAt.seconds ? new Date(p.createdAt.seconds * 1000).toLocaleDateString() : 'Just now') : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeMenu === 'overview' && (
          <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
            <h3>Debug Tools</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={async () => {
                  try {
                    const timetablesRef = rtdbRef(rtdb, 'timetables/Computer Science/Semester 1/Monday/9AM');
                    await set(timetablesRef, {
                      subject: "Introduction to CS",
                      teacherEmpId: "T-123",
                      teacherName: "Test Teacher",
                      room: "101",
                      department: "Computer Science",
                      semester: "Semester 1"
                    });
                    alert("Seeded Timetable Data! Login as Teacher T-123 to see it.");
                  } catch (e) {
                    alert("Error seeding timetable: " + e.message);
                  }
                }}
                style={{ background: 'orange', color: 'white', padding: '10px' }}
              >
                Seed Timetable Data
              </button>

              <button
                onClick={async () => {
                  try {
                    const studentData = {
                      name: "Test Student",
                      email: "student@test.com",
                      rollNo: "S-101",
                      department: "Computer Science",
                      semester: "1",
                      totalFees: 50000,
                      createdAt: Date.now()
                    };

                    const snapshot = await rtdbGet(rtdbRef(rtdb, 'students'));
                    const students = snapshot.val() || {};
                    const exists = Object.values(students).some(s => s.email === "student@test.com" || s.rollNo === "S-101");
                    const exists = Object.values(students).some(s => s.email === "student@test.com");

                    if (exists) {
                      alert("Test Student already exists in master list.");
                    } else {
                      await set(push(rtdbRef(rtdb, 'students')), studentData);
                      alert("Seed Successful!\\n\\n1. Go to Login\\n2. Select 'Student' role\\n3. Click 'First Time Login'\\n4. Email: student@test.com\\n5. Roll Number: S-101\\n6. Set your own password!");
                      alert("Seed Successful!\n\n1. Go to Login\n2. Select 'Student' role\n3. Click 'First Time Login'\n4. Email: student@test.com\n5. Set your own password!");
                    }
                  } catch (e) {
                    alert("Error seeding student: " + e.message);
                  }
                }}
                style={{ background: '#28a745', color: 'white', padding: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
              >
                Seed Test Student (S-101)
              </button>

              <button
                onClick={async () => {
                  try {
                    const timetablesRef = rtdbRef(rtdb, 'timetables/Computer Science/Semester 1/Monday/9AM');
                    await set(timetablesRef, {
                      subject: "Introduction to CS",
                      teacherEmpId: "T-123",
                      teacherName: "Test Teacher",
                      room: "101",
                      department: "Computer Science",
                      semester: "Semester 1"
                    });
                    alert("Seeded Timetable Data! Login as Teacher T-123 to see it.");
                  } catch (e) {
                    alert("Error seeding: " + e.message);
                  }
                }}
                style={{ background: 'orange', color: 'white', padding: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
              >
                Seed Timetable Data
              </button>
                style={{ background: '#28a745', color: 'white', padding: '10px' }}
              >
                Seed Test Student (S-101)
              </button>
            </div>
          </div>
        )}
        {activeMenu === 'users' && (
          <div className="users-section">
            <h1>Registered Users</h1>
            {loadingUsers ? <p>Loading users...</p> : usersList.length === 0 ? <p>No users found.</p> : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>UID</th><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.uid}>
                      <td>{u.uid}</td>
                      <td>{u.name || ''}</td>
                      <td>{u.username || ''}</td>
                      <td>{u.email || ''}</td>
                      <td>{u.role || ''}</td>
                      <td>{u.createdAt ? (typeof u.createdAt === 'number' ? new Date(u.createdAt).toLocaleString() : u.createdAt) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeMenu === "division-settings" && (
          <div className="add-subject-section">
            <h1>Division Settings</h1>
            <div className="form-container" style={{ maxWidth: '800px' }}>
              <div className="selector" style={{ marginBottom: '20px' }}>
                <label>Select Department to Configure:</label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  style={{ width: '100%', padding: '10px' }}
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="divisions-grid">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Semester</th>
                      <th>Number of Divisions</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 8 }, (_, i) => `Semester ${i + 1}`).map(sem => {
                      // Defensive check for department
                      const deptName = selectedDept === 'All' ? departments[0] : (selectedDept || departments[0]);
                      // Defensive check for divisionSettings
                      const count = (divisionSettings && divisionSettings[deptName] && divisionSettings[deptName][sem])
                        ? divisionSettings[deptName][sem]
                        : 1;

                      return (
                        <tr key={sem}>
                          <td>{sem}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{count}</span>
                              <span style={{ fontSize: '0.8em', color: '#94a3b8' }}>
                                ({Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i)).join(', ')})
                              </span>
                            </div>
                          </td>
                          <td>
                            <button
                              className="edit-btn"
                              onClick={async () => {
                                // Increment
                                const newCount = count + 1;
                                if (newCount > 5) return alert("Max 5 divisions allowed.");

                                const updatePath = `settings/divisions/${deptName}/${sem}`;
                                await set(rtdbRef(rtdb, updatePath), newCount);

                                // Opti-update
                                setDivisionSettings(prev => ({
                                  ...prev,
                                  [deptName]: {
                                    ...(prev[deptName] || {}),
                                    [sem]: newCount
                                  }
                                }));
                              }}
                              style={{ padding: '5px 10px', marginRight: '5px' }}
                            >
                              +
                            </button>
                            <button
                              className="edit-btn"
                              onClick={async () => {
                                // Decrement
                                const newCount = count - 1;
                                if (newCount < 1) return alert("At least 1 division required.");

                                const updatePath = `settings/divisions/${deptName}/${sem}`;
                                await set(rtdbRef(rtdb, updatePath), newCount);

                                setDivisionSettings(prev => ({
                                  ...prev,
                                  [deptName]: {
                                    ...(prev[deptName] || {}),
                                    [sem]: newCount
                                  }
                                }));
                              }}
                              style={{ padding: '5px 10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                            >
                              -
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeMenu === "students" && (
          <div className="add-subject-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h1>Student Management</h1>
              <button
                onClick={() => {
                  if (showStudentForm) {
                    // Reset form when closing
                    setEditingStudentId(null);
                    setStudentName("");
                    setStudentEmail("");
                    // ... reset other states
                  }
                  setShowStudentForm(!showStudentForm);
                }}
                className="edit-btn"
                style={{ background: showStudentForm ? '#6b7280' : 'var(--accent-cyan)', color: 'white' }}
              >
                {showStudentForm ? "Hide Form" : (editingStudentId ? "Edit Student" : "+ Add New Student")}
              </button>
            </div>

            {showStudentForm && (
              <div className="form-container" style={{ maxWidth: '800px', marginBottom: '30px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h2 style={{ marginTop: 0 }}>{editingStudentId ? "Edit Student Details" : "Register New Student"}</h2>
                <form onSubmit={handleAddStudentSubmit}>
                  {/* Basic Info */}
                  <div className="form-row cols-2">
                    <div className="form-group">
                      <label>Full Name</label>
                      <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Full Name" required />
                    </div>
                    <div className="form-group">
                      <label>Email Address</label>
                      <input type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="student@school.com" required />
                    </div>
                  </div>

                  {/* Academic Info */}
                  <div className="form-row cols-3">
                    <div className="form-group">
                      <label>Department</label>
                      <select value={studentDept} onChange={(e) => setStudentDept(e.target.value)}>
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Semester</label>
                      <select value={studentSemester} onChange={(e) => setStudentSemester(e.target.value)}>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s.toString()}>Semester {s}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Division</label>
                      <select value={studentDivision} onChange={(e) => setStudentDivision(e.target.value)}>
                        {["A", "B", "C", "D", "E"].map(div => <option key={div} value={div}>Division {div}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Personal Info */}
                  <div className="form-row cols-3">
                    <div className="form-group">
                      <label>Phone Number</label>
                      <input value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)} placeholder="Contact Number" />
                    </div>
                    <div className="form-group">
                      <label>Date of Birth</label>
                      <input type="date" value={studentDOB} onChange={(e) => setStudentDOB(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Annual Fees</label>
                      <input type="number" value={studentTotalFees} onChange={(e) => setStudentTotalFees(e.target.value)} placeholder="0" />
                    </div>
                  </div>

                  {/* Family Info */}
                  <div className="form-row cols-2">
                    <div className="form-group">
                      <label>Father's Name</label>
                      <input value={studentFatherName} onChange={(e) => setStudentFatherName(e.target.value)} placeholder="Father's Name" />
                    </div>
                    <div className="form-group">
                      <label>Mother's Name</label>
                      <input value={studentMotherName} onChange={(e) => setStudentMotherName(e.target.value)} placeholder="Mother's Name" />
                    </div>
                  </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)} placeholder="Contact Number" />
                  </div>
                </div>
                  {/* Identity Info */}
                  <div className="form-row cols-2">
                    <div className="form-group">
                      <label>Religion</label>
                      <input value={studentReligion} onChange={(e) => setStudentReligion(e.target.value)} placeholder="e.g. Hindu" />
                    </div>
                    <div className="form-group">
                      <label>Caste / Category</label>
                      <input value={studentCaste} onChange={(e) => setStudentCaste(e.target.value)} placeholder="Caste" />
                    </div>
                  </div>

                  {/* Guardian Info */}
                  <div className="form-row cols-2">
                    <div className="form-group">
                      <label>Guardian Name</label>
                      <input value={studentGuardianName} onChange={(e) => setStudentGuardianName(e.target.value)} placeholder="Guardian Name" />
                    </div>
                    <div className="form-group">
                      <label>Guardian Address</label>
                      <input value={studentGuardianAddress} onChange={(e) => setStudentGuardianAddress(e.target.value)} placeholder="Guardian Address" />
                    </div>
                  </div>

                  <div className="form-buttons" style={{ marginTop: '10px' }}>
                    <button type="submit" style={{ background: 'var(--accent-cyan)' }}>{editingStudentId ? "Update Student" : "Register Student"}</button>
                    <button type="button" onClick={() => {
                      setShowStudentForm(false);
                      setEditingStudentId(null);
                      setStudentName("");
                      setStudentEmail("");
                      setStudentDivision("A");
                      setStudentDOB("");
                      setStudentFatherName("");
                      setStudentMotherName("");
                      setStudentReligion("");
                      setStudentCaste("");
                      setStudentPhone("");
                      setStudentGuardianName("");
                      setStudentGuardianAddress("");
                      setStudentTotalFees(0);
                    }} style={{ background: 'rgba(255,255,255,0.1)' }}>Cancel</button>
                    {editingStudentId && (
                      <button type="button" onClick={handleDeleteStudent} style={{ marginLeft: 'auto', background: '#dc3545', color: 'white' }}>Delete Student</button>
                    )}
                  </div>
                </form>
              </div>
            )}

            <div style={{ marginTop: 30 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', marginBottom: '25px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--accent-cyan)' }}>Register Number Generator</h3>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem' }}>College Code</label>
                    <input
                      value={collegeCode}
                      onChange={(e) => setCollegeCode(e.target.value.toUpperCase())}
                      placeholder="JEC"
                      style={{ width: '100px' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem' }}>Admission Year</label>
                    <input
                      value={admissionYear}
                      onChange={(e) => setAdmissionYear(e.target.value)}
                      placeholder="23"
                      style={{ width: '80px' }}
                    />
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem', paddingBottom: '10px' }}>
                    Preview: <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{collegeCode}{admissionYear}XX###</span>
                  </div>
                  <button
                    onClick={handleGenerateRegisterNumbers}
                    className="edit-btn"
                    style={{ background: 'var(--accent-violet)', color: 'white', border: 'none' }}
                  >
                    Generate for All
                  </button>
                </div>
                <p style={{ margin: '10px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                  * This will assign sequential numbers (001, 002...) to students sorted alphabetically within each department.
                </p>
              </div>

                <div className="form-buttons">
                  <button type="submit">{editingStudentId ? "Update Student" : "Add Student"}</button>
                  {editingStudentId && (
                    <button type="button" onClick={() => {
                      setEditingStudentId(null); setStudentName(""); setStudentEmail("");
                      setStudentDivision("A"); setStudentDOB("");
                      setStudentFatherName(""); setStudentMotherName("");
                      setStudentReligion(""); setStudentCaste(""); setStudentPhone("");
                      setStudentGuardianName(""); setStudentGuardianAddress("");
                      setStudentTotalFees(0);
                    }}>Cancel Edit</button>
                  )}
                  {editingStudentId && (
                    <button type="button" onClick={handleDeleteStudent} style={{ marginLeft: '10px', background: '#dc3545', color: 'white' }}>Delete</button>
                  )}
                </div>
              </form>
            </div>

            <div style={{ marginTop: 30 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
                <h2>All Students</h2>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <div className="selector">
                    <label>Filter by Dept:</label>
                    <select value={studentFilterDept} onChange={(e) => setStudentFilterDept(e.target.value)}>
                      <option value="All">All Departments</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="selector">
                    <label>Filter by Year:</label>
                    <select value={studentFilterYear} onChange={(e) => setStudentFilterYear(e.target.value)}>
                      <option value="All">All Years</option>
                      <option value="1">First Year</option>
                      <option value="2">Second Year</option>
                      <option value="3">Third Year</option>
                      <option value="4">Fourth Year</option>
                    </select>
                  </div>
                </div>
              </div>
              <table className="subjects-table">
                <thead>
                  <tr><th>S.No</th><th>Reg.No</th><th>Name</th><th>Email</th><th>Dept</th><th>Sem</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = studentsList.filter(s => {
                      const matchesDept = studentFilterDept === "All" || s.department === studentFilterDept;
                      const sem = parseInt(s.semester);
                      let matchesYear = true;
                      if (studentFilterYear !== "All") {
                        const targetYear = parseInt(studentFilterYear);
                        const studentYear = Math.ceil(sem / 2);
                        matchesYear = studentYear === targetYear;
                      }
                      return matchesDept && matchesYear;
                    });

                    // Group by department
                    const groups = {};
                    filtered.forEach(s => {
                      const dept = s.department || "Unassigned";
                      if (!groups[dept]) groups[dept] = [];
                      groups[dept].push(s);
                    });

                    // Sort departments
                    const sortedDepts = Object.keys(groups).sort();

                    if (sortedDepts.length === 0) {
                      return (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>No students found matching filters.</td>
                        </tr>
                      );
                    }

                    return sortedDepts.map(dept => (
                      <React.Fragment key={dept}>
                        <tr className="dept-header-row" style={{ background: 'rgba(56, 189, 248, 0.1)' }}>
                          <td colSpan="7" style={{ fontWeight: 'bold', color: '#38bdf8', padding: '12px', borderLeft: '4px solid #38bdf8' }}>
                            {dept.toUpperCase()} — {groups[dept].length} {groups[dept].length === 1 ? 'Student' : 'Students'}
                          </td>
                        </tr>
                        {groups[dept]
                          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                          .map((s, index) => (
                            <tr key={s.id}>
                              <td>{index + 1}</td>
                              <td style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace', fontWeight: 'bold' }}>{s.registerNo || '-'}</td>
                              <td>{s.name}</td>
                              <td>{s.email}</td>
                              <td>{s.department}</td>
                              <td>{s.semester}</td>
                              <td>
                                <button onClick={() => handleEditStudent(s)} className="edit-btn">Edit</button>
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeMenu === "settings" && (
          <div className="add-subject-section">
            <h1>Administrative Settings</h1>
            <div className="form-container" style={{ maxWidth: '600px' }}>
              <h2>Student Detail Update Control</h2>

              <div className="control-card" style={{ marginBottom: '30px', padding: '20px', background: 'rgba(188, 19, 254, 0.05)', border: '1px solid var(--accent-violet)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--accent-cyan)' }}>Manual Unlock</h3>
                    <p className="description" style={{ margin: '5px 0 0 0', fontSize: '0.8rem' }}>Override the time window and allow students to edit their profiles immediately.</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={isUnlocked} onChange={handleToggleUnlock} />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>

              <div style={{ opacity: isUnlocked ? 0.5 : 1, pointerEvents: isUnlocked ? 'none' : 'auto' }}>
                <h2>Scheduled Access Window</h2>
                <p className="description">Set the time period during which students can update their personal details. (Disabled if Manual Unlock is ON)</p>
                <form onSubmit={handleUpdateWindowSubmit}>
                  <div className="form-group">
                    <label>Window Start Date & Time</label>
                    <input type="datetime-local" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Window End Date & Time</label>
                    <input type="datetime-local" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} required />
                  </div>
                  <div className="form-buttons">
                    <button type="submit">Update Window</button>
                  </div>
                </form>
              </div>

              <div className="current-status" style={{ marginTop: '30px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <strong>Current Status:</strong> {isUnlocked || (Date.now() >= settings.student_update_window?.start && Date.now() <= settings.student_update_window?.end) ?
                  <span style={{ color: '#22c55e', textShadow: '0 0 10px rgba(34, 197, 94, 0.4)' }}>🔓 OPEN (Full Access)</span> :
                  <span style={{ color: '#ef4444', textShadow: '0 0 10px rgba(239, 68, 68, 0.4)' }}>🔒 CLOSED (View Only)</span>
                }
                {isUnlocked && <div style={{ fontSize: '0.75rem', marginTop: '5px', color: 'var(--accent-violet)' }}>* Manually unlocked by administrator</div>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminHomePage;