import React, { useState, useEffect } from "react";
import "./home.css";
import { auth, db, rtdb, firebaseConfig } from "./firebase";
import { ref, get, set, push, update, remove, serverTimestamp } from "firebase/database";
import { User, Calendar, FileText, Star, Users } from "lucide-react";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const hours = ["9:00-9:50", "9:50-10:40", "10:50-11:40", "11:40-12:30", "1:20-2:10", "2:20-3:10", "3:10-4:00"];
const departments = ["Computer Science", "Electronics & Communication", "Mechanical Engineering", "Civil Engineering", "Electrical & Electronics", "Information Technology", "Artificial Intelligence", "Cyber Security"];

const getDeptShortName = (dept) => {
  const map = {
    "Computer Science": "CSE",
    "Electronics & Communication": "ECE",
    "Mechanical Engineering": "ME",
    "Civil Engineering": "CE",
    "Electrical & Electronics": "EEE",
    "Information Technology": "IT",
    "Artificial Intelligence": "AI",
    "Cyber Security": "CYS"
  };
  return map[dept] || dept;
};



const StaffHomePage = () => {
  const [activeMenu, setActiveMenu] = useState("timetable");
  const [user, setUser] = useState(null);

  // Division Settings State
  const [divisionSettings, setDivisionSettings] = useState({});

  useEffect(() => {
    const fetchDivisionSettings = async () => {
      try {
        const settingsRef = ref(rtdb, 'settings/divisions');
        const snapshot = await get(settingsRef);
        if (snapshot.exists()) {
          setDivisionSettings(snapshot.val());
        }
      } catch (error) {
        console.error("Error fetching division settings:", error);
      }
    };
    fetchDivisionSettings();
  }, []);

  const getClassOptions = (dept, sem) => {
    const code = getDeptShortName(dept);
    const count = (divisionSettings[dept] && divisionSettings[dept][sem]) || 1; // Default to 1 (Section A)
    return Array.from({ length: count }, (_, i) => `${code} ${String.fromCharCode(65 + i)}`);
  };

  // Preference Form State
  const [prefForm, setPrefForm] = useState({
    semester: "Semester 1",
    department: "Computer Science",
    subjectPref1: "",
    subjectPref2: "",
    subjectPref3: "",
    classPref1: "",
    classPref2: "",
    classPref3: ""
  });

  const [loadingPref, setLoadingPref] = useState(false);
  const [availableSubjects, setAvailableSubjects] = useState([]);

  // Fetch subjects for the staff's department
  useEffect(() => {
    if (activeMenu === 'preferences' && user) {
      const fetchSubjects = async () => {
        try {
          const subjectsRef = ref(rtdb, 'subjects');
          const snapshot = await get(subjectsRef);
          if (snapshot.exists()) {
            const data = snapshot.val();
            // console.log("All subjects:", data); 
            const subjects = Object.keys(data)
              .map(key => ({ id: key, ...data[key] }))
              .filter(s => {
                // Loose matching for department to avoid case/spacing issues
                const userDept = (user.department || "").trim().toLowerCase();
                const subjectDept = (s.department || "").trim().toLowerCase();
                return userDept === subjectDept || user.department === "All"; // Handle 'All' or exact match
              });
            setAvailableSubjects(subjects);
          } else {
          }
        } catch (error) {
          console.error("Error fetching subjects:", error);
        }
      };
      fetchSubjects();
    } else {
    }
  }, [activeMenu, user]);

  // Student Management State (For Tutors)
  const [myStudents, setMyStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentForm, setStudentForm] = useState({
    name: "",
    department: "",
    admissionYear: "",
    email: ""
  });
  const [editingStudentId, setEditingStudentId] = useState(null);

  const isWithinDutyPeriod = () => {
    if (!user) return false;
    // Admins always have access if they somehow use this page, 
    // but the role check here is more for staff.
    if (user.role === 'admin') return true;

    if (user.isAdmissionDuty !== true && user.isAdmissionDuty !== "true") return false;

    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

    const { admissionDutyStartDate, admissionDutyEndDate, admissionDutyStartTime, admissionDutyEndTime } = user;

    // If no dates/times are set, assume it's always active if isAdmissionDuty is true
    if (!admissionDutyStartDate || !admissionDutyEndDate) return true;

    const isDateInRange = today >= admissionDutyStartDate && today <= admissionDutyEndDate;
    if (!isDateInRange) return false;

    if (admissionDutyStartTime && admissionDutyEndTime) {
      const isTimeInRange = currentTime >= admissionDutyStartTime && currentTime <= admissionDutyEndTime;
      return isTimeInRange;
    }

    return true;
  };

  const handlePrefChange = (e) => {
    setPrefForm({ ...prefForm, [e.target.name]: e.target.value });
  };


  const handlePreferenceSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setLoadingPref(true);
    try {
      const newPrefRef = push(ref(rtdb, "preferences"));
      await set(newPrefRef, {
        ...prefForm,
        teacherUid: auth.currentUser.uid,
        teacherEmpId: user.employeeId || '',
        teacherName: user.name || '',
        teacherEmail: user.email || '',
        createdAt: serverTimestamp()
      });
      alert("Preferences submitted successfully!");
      setPrefForm({
        semester: "Semester 1",
        department: "Computer Science",
        subjectPref1: "",
        subjectPref2: "",
        subjectPref3: "",
        classPref1: "",
        classPref2: "",
        classPref3: ""
      });
      setActiveMenu("timetable");
    } catch (error) {
      console.error("Error submitting preferences:", error);
      alert("Error submitting preferences: " + error.message);
    } finally {
      setLoadingPref(false);
    }
  };

  const handleStudentChange = (e) => {
    setStudentForm({ ...studentForm, [e.target.name]: e.target.value });
  };

  const handleEditStudent = (student) => {
    setEditingStudentId(student.id);
    setStudentForm({
      name: student.name || "",
      department: student.department || "",
      admissionYear: student.admissionYear || "",
      email: student.email || ""
    });
    // Scroll to form
    const formElement = document.querySelector('.students-section .form-container');
    if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!user) return;

    // Basic Validation
    if (!studentForm.name || !studentForm.department || !studentForm.admissionYear) {
      alert("Please fill in Name, Department, and Year of Admission.");
      return;
    }
    if (user.department && studentForm.department !== user.department) {
      alert(`You can only manage students in your own department: ${user.department}`);
      return;
    }

    if (!isWithinDutyPeriod()) {
      alert("Access Denied: You are outside of your assigned Admission Duty period or working hours.");
      return;
    }

    try {
      const studentsRef = ref(rtdb, 'students');

      if (editingStudentId) {
        // Update existing student
        const studentRef = ref(rtdb, `students/${editingStudentId}`);
        await update(studentRef, {
          ...studentForm,
          updatedAt: serverTimestamp()
        });
        alert("Student updated successfully!");
      } else {
        // Add new student
        const newStudentRef = push(studentsRef);
        await set(newStudentRef, {
          ...studentForm,
          tutorUid: user.uid || auth.currentUser.uid,
          tutorName: user.name || "Staff",
          addedBy: "tutor",
          createdAt: serverTimestamp()
        });
        alert("Student added successfully!");
      }

      setStudentForm({
        name: "",
        department: user.department || "", // Keep dept selected
        admissionYear: "",
        email: ""
      });
      setEditingStudentId(null);

      // Refresh list will happen automatically if we use onValue, 
      // but here we are using manual fetch in useEffect. 
      // We'll trigger a re-fetch or update local state.
      fetchMyStudents();

    } catch (error) {
      console.error("Error adding student:", error);
      alert("Error adding student: " + error.message);
    }
  };

  const fetchMyStudents = async () => {
    setLoadingStudents(true);
    try {
      const studentsRef = ref(rtdb, 'students');
      const snapshot = await get(studentsRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Filter students. 
        // Logic: Show students added by this tutor OR students in the tutor's department/class.
        // For now, let's show students in the Tutor's Department as a baseline, 
        // or those explicitly added by them.
        const filtered = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).filter(s => {
          // If on Admission Duty, they might see all students or just their dept?
          // Keeping existing filter but ensuring we have a clean list.
          return s.department === user.department || s.tutorUid === user.uid;
        });

        // Final Sort: Department First, then Name Alphabetically
        const sorted = filtered.sort((a, b) =>
          (a.department || "").localeCompare(b.department || "") ||
          (a.name || "").localeCompare(b.name || "")
        );
        setMyStudents(sorted);
      } else {
        setMyStudents([]);
      }
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (activeMenu === 'my-students' && user) {
      setStudentForm(prev => ({ ...prev, department: user.department || "" }));
      fetchMyStudents();
    }
  }, [activeMenu, user]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      try {
        if (user) {
          // Fetch from RTDB 'staffs' node
          let finalUser = null;
          const staffRef = ref(rtdb, `staffs/${user.uid}`);
          const snapshot = await get(staffRef);
          if (snapshot.exists()) {
            finalUser = snapshot.val();
          } else {
            // Fallback to check 'users' node if not in staffs
            const userRef = ref(rtdb, `users/${user.uid}`);
            const userSnap = await get(userRef);
            if (userSnap.exists()) {
              finalUser = userSnap.val();
            } else {
              console.warn("Staff profile not found for user:", user.uid);
              finalUser = null;
            }
          }

          // Secondary Fetch: Get definitive Tutor status from 'teachers' node
          // This fixes issues where the staff profile might be out of sync
          // Use auth email as fallback if DB profile is missing email
          if ((finalUser && finalUser.email) || user.email) {
            try {
              const teachersRef = ref(rtdb, 'teachers');
              const snapshot = await get(teachersRef);
              if (snapshot.exists()) {
                const allTeachers = snapshot.val();
                const searchEmail = (finalUser && finalUser.email) || user.email;
                if (!searchEmail) {
                  console.warn("No email found to search teachers.");
                } else {
                  // Find teacher record by email (case-insensitive)
                  const teacherRecord = Object.values(allTeachers).find(t =>
                    t.email && t.email.toLowerCase().trim() === searchEmail.toLowerCase().trim()
                  );

                  if (teacherRecord) {
                    // Merge definitive tutor status
                    finalUser = {
                      ...finalUser,
                      isTutor: teacherRecord.isTutor || false,
                      tutorClassDept: teacherRecord.tutorClassDept || "",
                      tutorClassSem: teacherRecord.tutorClassSem || "",
                      tutorClassDiv: teacherRecord.tutorClassDiv || "",
                      isAdmissionDuty: teacherRecord.isAdmissionDuty || false,
                      admissionDutyStartDate: teacherRecord.admissionDutyStartDate || "",
                      admissionDutyEndDate: teacherRecord.admissionDutyEndDate || "",
                      admissionDutyStartTime: teacherRecord.admissionDutyStartTime || "",
                      admissionDutyEndTime: teacherRecord.admissionDutyEndTime || "",
                      // also sync other fields if missing
                      department: finalUser.department || teacherRecord.department,
                      employeeId: finalUser.employeeId || teacherRecord.employeeId,
                      email: finalUser.email || teacherRecord.email
                    };
                  }
                }
              }
            } catch (err) {
              console.error("Error fetching teacher record:", err);
            }
          }

          // If finalUser is found/merged, ensure the email is set from the Auth User object
          // This guarantees it is never empty if the user is authenticated.
          if (finalUser) {
            finalUser.uid = user.uid; // Ensure UID is attached
            finalUser.email = finalUser.email || user.email;
            // Also ensure name fallback if DB is partial
            finalUser.name = finalUser.name || user.displayName || "Staff Member";
          }

          setUser(finalUser);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth onAuthStateChanged error (staff):", error);
      }
    });
    return unsubscribe;
  }, []);

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Sign out error:", error);
      alert(`${error.code || "auth/error"}: ${error.message}`);
    }
  };

  // Timetable State
  const [timetable, setTimetable] = useState({});
  const [loadingTimetable, setLoadingTimetable] = useState(false);

  useEffect(() => {
    if (!user || activeMenu !== 'timetable') return;

    const fetchTimetable = async () => {
      setLoadingTimetable(true);
      try {
        // We need to fetch all timetables and filter for this teacher
        // Structure: timetables/{department}/{semester}/{day}/{hour} -> { subject, teacherEmpId, room ... }
        // Since we don't know exactly which dept/sem the teacher is in (they could be in multiple), we might need to fetch root or query by index if possible.
        // For now, fetching root 'timetables' and client-side filtering. 
        // In a production app with huge data, we'd use an index like classes_by_teacher/{teacherId}

        const timetablesRef = ref(rtdb, 'timetables');
        const snapshot = await get(timetablesRef);

        if (snapshot.exists()) {
          const allData = snapshot.val();
          const mySchedule = {}; // Key: "Day-Time" (e.g., "Monday-8AM") -> value: { subject, room, dept, sem }

          // Iterate Departments
          Object.keys(allData).forEach(dept => {
            const deptData = allData[dept];
            // Iterate Semesters
            Object.keys(deptData).forEach(sem => {
              const semData = deptData[sem];
              // Iterate Divisions (or fallback for older data that doesn't have division layer)
              Object.keys(semData).forEach(divOrDay => {
                const divOrDayData = semData[divOrDay];

                // If it's a day, it means it's older data without Division layer
                if (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(divOrDay)) {
                  // divOrDay is actually Day
                  const day = divOrDay;
                  const dayData = divOrDayData;
                  Object.keys(dayData).forEach(hour => {
                    const slot = dayData[hour];
                    if (slot && slot.teacherEmpId === user.employeeId) {
                      mySchedule[`${day}-${hour}`] = { ...slot, department: dept, semester: sem, division: 'A' };
                    }
                  });
                } else {
                  // divOrDay is Division
                  const div = divOrDay;
                  const divData = divOrDayData;
                  Object.keys(divData).forEach(day => {
                    const dayData = divData[day];
                    Object.keys(dayData).forEach(hour => {
                      const slot = dayData[hour];
                      // Check if this slot belongs to the current teacher
                      if (slot && slot.teacherEmpId === user.employeeId) {
                        mySchedule[`${day}-${hour}`] = {
                          ...slot,
                          department: dept,
                          semester: sem,
                          division: div
                        };
                      }
                    });
                  });
                }
              });
            });
          });
          setTimetable(mySchedule);
        } else {
          setTimetable({});
        }

      } catch (error) {
        console.error("Error fetching timetable:", error);
      } finally {
        setLoadingTimetable(false);
      }
    };

    fetchTimetable();
  }, [user, activeMenu]);

  const getSlot = (day, hour) => {
    const key = `${day}-${hour}`;
    return timetable[key];
  };

  const handleDeleteStudent = async () => {
    if (!editingStudentId) return;
    if (!window.confirm("Are you sure you want to delete this student?")) return;
    try {
      await remove(ref(rtdb, `students/${editingStudentId}`));
      alert("Student deleted successfully.");
      setEditingStudentId(null);
      setStudentForm({
        name: "",
        rollNo: "",
        department: user.department || "",
        admissionYear: "",
        email: ""
      });
      fetchMyStudents();
    } catch (err) {
      alert("Error deleting student: " + err.message);
    }
  };

  // Tutor Class State
  const [tutorDept, setTutorDept] = useState("");
  const [tutorSem, setTutorSem] = useState("Semester 1");
  const [tutorDiv, setTutorDiv] = useState("A");
  const [tutorTimetable, setTutorTimetable] = useState({});
  const [tutorStudentsList, setTutorStudentsList] = useState([]);
  const [loadingTutorClass, setLoadingTutorClass] = useState(false);

  useEffect(() => {
    if (activeMenu === 'tutor-class' && user) {
      if (!tutorDept && user.tutorClassDept) setTutorDept(user.tutorClassDept);
      if (user.tutorClassSem) setTutorSem(user.tutorClassSem);
      if (user.tutorClassDiv) setTutorDiv(user.tutorClassDiv);
    }
  }, [activeMenu, user, tutorDept]);

  const fetchTutorClassConfig = async () => {
    if (!tutorDept || !tutorSem || !tutorDiv) {
      alert("Please select Department, Semester, and Division to view.");
      return;
    }
    setLoadingTutorClass(true);
    try {
      // 1. Fetch Timetable
      const ttRef = ref(rtdb, `timetables/${tutorDept}/${tutorSem}/${tutorDiv}`);
      const ttSnap = await get(ttRef);
      if (ttSnap.exists()) {
        setTutorTimetable(ttSnap.val());
      } else {
        // Fallback to older structure without division if needed, or set empty
        const ptRef = ref(rtdb, `timetables/${tutorDept}/${tutorSem}`);
        const ptSnap = await get(ptRef);
        if (ptSnap.exists() && ptSnap.val().Monday && ptSnap.val().Monday['9:00-9:50']) {
          setTutorTimetable(ptSnap.val());
        } else {
          setTutorTimetable({});
        }
      }

      // 2. Fetch Students
      const stdRef = ref(rtdb, 'students');
      const stdSnap = await get(stdRef);
      if (stdSnap.exists()) {
        const allStd = stdSnap.val();
        const filtered = Object.keys(allStd).map(k => ({ id: k, ...allStd[k] }))
          .filter(s => s.department === tutorDept && s.semester === tutorSem && (s.division === tutorDiv || (!s.division && tutorDiv === 'A')));
        setTutorStudentsList(filtered);
      } else {
        setTutorStudentsList([]);
      }
    } catch (err) {
      console.error("Error fetching tutor class details:", err);
      alert("Error fetching details: " + err.message);
    } finally {
      setLoadingTutorClass(false);
    }
  };


  return (
    <div className="home-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <h2 className="logo">Schedulix Staff</h2>

        <ul className="menu">
          <li
            className={activeMenu === "profile" ? "active" : ""}
            onClick={() => setActiveMenu("profile")}
          >
            <User size={20} className="menu-icon" /> Personal Details
          </li>
          <li
            className={activeMenu === "timetable" ? "active" : ""}
            onClick={() => setActiveMenu("timetable")}
          >
            <Calendar size={20} className="menu-icon" /> My Timetable
          </li>
          <li
            className={activeMenu === "schedule" ? "active" : ""}
            onClick={() => setActiveMenu("schedule")}
          >
            <FileText size={20} className="menu-icon" /> Class Schedule
          </li>
          {/* 
          <li
            className={activeMenu === "preferences" ? "active" : ""}
            onClick={() => setActiveMenu("preferences")}
          >
            <Star size={20} className="menu-icon" /> Subject Preferences
          </li>
          */}
          {user && (user.isAdmissionDuty === true || user.isAdmissionDuty === "true") && isWithinDutyPeriod() && (
            <li
              className={activeMenu === "my-students" ? "active" : ""}
              onClick={() => setActiveMenu("my-students")}
            >
              <Users size={20} className="menu-icon" /> Student Admissions
            </li>
          )}
          {user && (user.isTutor === true || user.isTutor === "true") && (
            <li
              className={activeMenu === "tutor-class" ? "active" : ""}
              onClick={() => setActiveMenu("tutor-class")}
            >
              <Users size={20} className="menu-icon" /> My Tutor Class
            </li>
          )}
        </ul>

        <button onClick={handleSignOut} className="sign-out-btn">
          Sign Out
        </button>

      </aside>

      {/* Main Content */}
      <main className="content">
        {activeMenu === "profile" && (
          <div className="profile-section">
            <h1>Personal Details</h1>
            <div className="profile-card">
              <div className="profile-info">
                <div className="info-item">
                  <label>Name:</label>
                  <span>{user ? user.name : "Loading..."}</span>
                </div>
                <div className="info-item">
                  <label>Role:</label>
                  <span>Staff Teacher</span>
                </div>
                <div className="info-item">
                  <label>Email:</label>
                  <span>{user ? user.email : "Loading..."}</span>
                </div>
                <div className="info-item">
                  <label>Department:</label>
                  <span>{user ? user.department : "N/A"}</span>
                </div>
                <div className="info-item">
                  <label>Employee ID:</label>
                  <span>{user ? user.employeeId : "N/A"}</span>
                </div>
                <div className="info-item">
                  <label>Tutor Status:</label>
                  <span>{user ? ((user.isTutor === true || user.isTutor === "true") ? "Yes" : "No") : "N/A"}</span>
                </div>
                <div className="info-item">
                  <label>Admission Duty:</label>
                  <span>
                    {user ? ((user.isAdmissionDuty === true || user.isAdmissionDuty === "true")
                      ? (isWithinDutyPeriod() ? "Active (On Duty)" : "Inactive (Off Duty)")
                      : "No") : "N/A"}
                  </span>
                </div>
                {user && (user.isAdmissionDuty === true || user.isAdmissionDuty === "true") && (
                  <div className="info-item">
                    <label>Duty Period:</label>
                    <span style={{ fontSize: '0.9rem' }}>
                      {user.admissionDutyStartDate} to {user.admissionDutyEndDate}
                      <br />
                      ({user.admissionDutyStartTime} - {user.admissionDutyEndTime})
                    </span>
                  </div>
                )}
                {user && (user.isTutor === true || user.isTutor === "true") && (
                  <div className="info-item">
                    <label>Assigned Class:</label>
                    <span>{user.tutorClassDept ? `${user.tutorClassDept} - ${user.tutorClassSem} (${user.tutorClassDiv})` : "N/A"}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeMenu === "timetable" && (
          <div className="home-container">
            <h1>My Teaching Timetable</h1>
            {loadingTimetable ? <p>Loading schedule...</p> : (
              <table className="timetable">
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
                        const slot = getSlot(day, hour);
                        return (
                          <td
                            key={day + hour}
                            className={slot ? "has-class" : ""}
                            onClick={() => slot && alert(`Class: ${slot.subject}\nDept: ${slot.department}\nSem: ${slot.semester}\nDiv: ${slot.division}`)}
                          >
                            {slot ? (
                              <div className="slot-info">
                                <span className="subject">{slot.subject}</span>
                                <span className="details">{slot.semester} - {slot.department}</span>
                                <span className="details" style={{ fontWeight: 'bold' }}>Sec: {slot.division}</span>
                              </div>
                            ) : (
                              <span className="slot"></span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeMenu === "schedule" && (
          <div className="schedule-section">
            <h1>Class Schedule Overview</h1>
            <div className="schedule-grid">
              <div className="schedule-card">
                <h3>Scheduled Classes</h3>
                <p>No classes scheduled yet.</p>
              </div>
            </div>
          </div>
        )}

        {activeMenu === "preferences" && (
          <div className="preferences-section">
            <h1>Submit Subject Preferences</h1>
            <div className="form-container">
              <form onSubmit={handlePreferenceSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Semester</label>
                    <select name="semester" value={prefForm.semester} onChange={handlePrefChange}>
                      <option>Semester 1</option>
                      <option>Semester 2</option>
                      <option>Semester 3</option>
                      <option>Semester 4</option>
                      <option>Semester 5</option>
                      <option>Semester 6</option>
                      <option>Semester 7</option>
                      <option>Semester 8</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <select name="department" value={prefForm.department} onChange={handlePrefChange}>
                      {departments.map(dept => <option key={dept}>{dept}</option>)}
                    </select>
                  </div>
                </div>

                <h3>Subject Preferences</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Preference 1</label>
                    <select name="subjectPref1" value={prefForm.subjectPref1} onChange={handlePrefChange} required>
                      <option value="">-- Select Subject --</option>
                      {availableSubjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name} ({s.code}) - {s.semester}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Preference 2</label>
                    <select name="subjectPref2" value={prefForm.subjectPref2} onChange={handlePrefChange}>
                      <option value="">-- Select Subject --</option>
                      {availableSubjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name} ({s.code}) - {s.semester}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Preference 3</label>
                    <select name="subjectPref3" value={prefForm.subjectPref3} onChange={handlePrefChange}>
                      <option value="">-- Select Subject --</option>
                      {availableSubjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name} ({s.code}) - {s.semester}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <h3>Class Preferences</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Class Pref 1</label>
                    <select name="classPref1" value={prefForm.classPref1} onChange={handlePrefChange} required>
                      <option value="">-- Select Class --</option>
                      {getClassOptions(prefForm.department, prefForm.semester).map(cls => <option key={cls}>{cls}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Class Pref 2</label>
                    <select name="classPref2" value={prefForm.classPref2} onChange={handlePrefChange}>
                      <option value="">-- Select Class --</option>
                      {getClassOptions(prefForm.department, prefForm.semester).map(cls => <option key={cls}>{cls}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Class Pref 3</label>
                    <select name="classPref3" value={prefForm.classPref3} onChange={handlePrefChange}>
                      <option value="">-- Select Class --</option>
                      {getClassOptions(prefForm.department, prefForm.semester).map(cls => <option key={cls}>{cls}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="save-btn" disabled={loadingPref}>
                    {loadingPref ? "Submitting..." : "Submit Preferences"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeMenu === "my-students" && (
          <div className="students-section">
            <h1>Student Admissions</h1>
            <p className="subtitle">Manage student details for your department.</p>

            <div className="form-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>{editingStudentId ? "Edit Student Details" : "Add New Student"}</h3>
                {editingStudentId && (
                  <button
                    onClick={() => {
                      setEditingStudentId(null);
                      setStudentForm({
                        name: "",
                        rollNo: "",
                        department: user.department || "",
                        admissionYear: "",
                        email: ""
                      });
                    }}
                    style={{ background: '#6c757d', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Cancel Edit
                  </button>
                )}
                {editingStudentId && (
                  <button
                    onClick={handleDeleteStudent}
                    style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', marginLeft: '10px' }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <form onSubmit={handleAddStudent}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      name="name"
                      value={studentForm.name}
                      onChange={handleStudentChange}
                      required
                      placeholder="Student Full Name"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Department</label>
                    <select
                      name="department"
                      value={studentForm.department}
                      onChange={handleStudentChange}
                      required
                      disabled={!!user.department}
                    >
                      <option value="">Select Department</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Year of Admission</label>
                    <input
                      name="admissionYear"
                      type="number"
                      value={studentForm.admissionYear}
                      onChange={handleStudentChange}
                      required
                      placeholder="YYYY"
                      min="2000"
                      max="2100"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="save-btn">
                    {editingStudentId ? "Update Student Details" : "Add Student Details"}
                  </button>
                </div>
              </form>
            </div>

            <div className="table-container" style={{ marginTop: '2rem' }}>
              <h3>Admissions List Summary ({myStudents.length} Students)</h3>
              {loadingStudents ? (
                <p>Loading...</p>
              ) : myStudents.length === 0 ? (
                <p>No students found for your department.</p>
              ) : (
                <>
                  {[...new Set(myStudents.map(s => s.department))].sort().map(dept => {
                    const studentsInDept = myStudents.filter(s => s.department === dept)
                      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

                    return (
                      <div key={dept} style={{ marginBottom: '2.5rem', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px', background: 'rgba(30, 41, 59, 0.4)', backdropFilter: 'blur(10px)' }}>
                        <h3 style={{ borderBottom: '2px solid #6366f1', paddingBottom: '12px', color: '#818cf8', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{dept || "Unassigned Department"}</span>
                          <span style={{ fontSize: '0.9rem', background: 'rgba(99, 102, 241, 0.2)', padding: '4px 12px', borderRadius: '20px' }}>{studentsInDept.length} Students</span>
                        </h3>
                        <table className="timetable" style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                              <th style={{ textAlign: 'left', padding: '16px', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>S.No</th>
                              <th style={{ textAlign: 'left', padding: '16px', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Student Name</th>
                              <th style={{ textAlign: 'left', padding: '16px', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Roll No</th>
                              <th style={{ textAlign: 'left', padding: '16px', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Year</th>
                              <th style={{ textAlign: 'left', padding: '16px', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Added By</th>
                              <th style={{ textAlign: 'left', padding: '16px', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentsInDept.map((student, index) => (
                              <tr key={student.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background 0.2s' }} className="student-row-hover">
                                <td style={{ padding: '16px', fontWeight: '600', color: '#6366f1' }}>{index + 1}</td>
                                <td style={{ padding: '16px', color: '#f8fafc' }}>{student.name}</td>
                                <td style={{ padding: '16px' }}>
                                  <span style={{ background: 'rgba(0, 243, 255, 0.1)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.9rem', color: '#22d3ee', border: '1px solid rgba(0, 243, 255, 0.2)' }}>
                                    {student.rollNo || 'Pending'}
                                  </span>
                                </td>
                                <td style={{ padding: '16px', color: '#cbd5e1' }}>{student.admissionYear || '-'}</td>
                                <td style={{ padding: '16px', color: '#94a3b8', fontSize: '0.9rem' }}>
                                  {student.tutorName || (student.addedBy === 'tutor' ? 'Tutor' : 'Admin')}
                                </td>
                                <td style={{ padding: '16px' }}>
                                  {student.tutorUid === user.uid && (
                                    <button
                                      onClick={() => handleEditStudent(student)}
                                      style={{
                                        padding: '6px 14px',
                                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                                        color: '#a5b4fc',
                                        border: '1px solid rgba(99, 102, 241, 0.4)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      Edit
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {activeMenu === "tutor-class" && (
          <div className="home-container">
            <h1>My Tutor Class</h1>
            <p className="subtitle">View timetable and student list for your assigned batch.</p>

            <div className="selector-section" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(15, 23, 42, 0.5)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <div className="selector">
                <label>Department:</label>
                <select value={tutorDept} onChange={(e) => setTutorDept(e.target.value)}>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="selector">
                <label>Semester:</label>
                <select value={tutorSem} onChange={(e) => setTutorSem(e.target.value)}>
                  {Array.from({ length: 8 }, (_, i) => `Semester ${i + 1}`).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="selector">
                <label>Division:</label>
                <select value={tutorDiv} onChange={(e) => setTutorDiv(e.target.value)}>
                  {['A', 'B', 'C', 'D'].map(d => <option key={d} value={d}>Section {d}</option>)}
                </select>
              </div>
              <button
                onClick={fetchTutorClassConfig}
                className="save-btn"
                style={{ marginLeft: 'auto', background: 'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)' }}
              >
                Fetch Class Details
              </button>
            </div>

            {loadingTutorClass ? <p>Loading class details...</p> : (
              <>
                <div style={{ marginBottom: '40px' }}>
                  <h3>Class Timetable</h3>
                  {Object.keys(tutorTimetable).length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="timetable" style={{ minWidth: '800px' }}>
                        <thead>
                          <tr>
                            <th>Time</th>
                            {days.map(d => <th key={d}>{d}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {hours.map(hour => (
                            <tr key={hour}>
                              <td>{hour}</td>
                              {days.map(day => {
                                const slot = tutorTimetable[day] ? tutorTimetable[day][hour] : null;
                                return (
                                  <td key={`${day}-${hour}`} className={slot ? "has-class" : ""}>
                                    {slot ? (
                                      <div className="slot-info">
                                        <span className="subject">{slot.subject}</span>
                                        <span className="details">{slot.teacherName}</span>
                                        <span className="details">{slot.room}</span>
                                      </div>
                                    ) : (
                                      <span className="slot">-</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: '#cbd5e1' }}>No timetable published yet for this class.</p>
                  )}
                </div>

                <div>
                  <h3>Enrolled Students ({tutorStudentsList.length})</h3>
                  {tutorStudentsList.length > 0 ? (
                    <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                      <table className="subjects-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Roll No</th>
                            <th>Email</th>
                            <th>Dept</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tutorStudentsList.map(s => (
                            <tr key={s.id}>
                              <td style={{ fontWeight: 'bold' }}>{s.name}</td>
                              <td>{s.rollNo || '-'}</td>
                              <td>{s.email || '-'}</td>
                              <td>{s.department || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: '#cbd5e1' }}>No students found enrolled in {tutorDept} - {tutorSem} - Div {tutorDiv}.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default StaffHomePage;
