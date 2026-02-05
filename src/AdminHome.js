import React, { useState, useEffect } from "react";
import "./AdminHome.css";
import { auth, db, firebaseConfig, rtdb } from "./firebase";


import { doc, getDoc, addDoc, collection, getDocs, query, where, updateDoc } from "firebase/firestore";
import { ref as rtdbRef, get as rtdbGet } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { cloudFunctions } from "./firebase";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const hours = ["8AM", "9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM"];

const classes = ["Class 10A", "Class 10B", "Class 9A", "Class 9B", "Class 8A"];
const teachers = ["Mr. Smith", "Ms. Johnson", "Mr. Davis", "Ms. Wilson", "Mr. Brown"];
const departments = ["Computer Science", "Electronics & Communication", "Mechanical Engineering", "Civil Engineering", "Electrical & Electronics", "Information Technology", "Artificial Intelligence", "Cyber Security"];

const AdminHomePage = () => {
  const [activeMenu, setActiveMenu] = useState("overview");
  const [selectedClass, setSelectedClass] = useState(classes[0]);
  const [selectedTeacher, setSelectedTeacher] = useState(teachers[0]);
  const [timetableData, setTimetableData] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [currentSlot, setCurrentSlot] = useState(null);
  const [subject, setSubject] = useState("");
  const [teacher, setTeacher] = useState("");
  const [room, setRoom] = useState("");
  const [user, setUser] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Subjects management
  const [semester, setSemester] = useState("Semester 1");
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [department, setDepartment] = useState("Computer Science");
  const [credits, setCredits] = useState("");
  const [teachingHours, setTeachingHours] = useState("");
  const [subjectsList, setSubjectsList] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Teachers management
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherDept, setTeacherDept] = useState("Computer Science");
  const [teacherEmpId, setTeacherEmpId] = useState("");
  const [teachersList, setTeachersList] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      try {
        if (user) {
          const docRef = doc(db, "admin", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUser(docSnap.data());
          } else {
            console.warn("Admin document not found for user:", user.uid);
            alert("Warning: Your account is logged in but does not have an 'Admin' profile in the database. You will not be able to add teachers. Please Sign Out and Sign Up again as an Admin.");
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth onAuthStateChanged error (admin):", error);
        alert(`${error.code || "auth/error"}: ${error.message}`);
      }
    });
    return unsubscribe;
  }, []);

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
        const q = query(collection(db, "subjects"), where("semester", "==", semester));
        const snap = await getDocs(q);
        if (!mounted) return;
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setSubjectsList(items);
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
        const q = query(collection(db, "teachers"));
        const snap = await getDocs(q);
        if (!mounted) return;
        setTeachersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Fetch teachers error:", err);
      } finally {
        if (mounted) setLoadingTeachers(false);
      }
    };
    fetchTeachers();
    return () => { mounted = false; };
  }, [activeMenu]);

  const handleAddTeacherSubmit = async (e) => {
    e.preventDefault();
    if (!teacherName || !teacherEmail || !teacherEmpId) {
      alert("Please fill all required fields");
      return;
    }
    try {
      // Check for duplicates (Email or EmpID)
      if (!editingTeacherId) {
        const qEmail = query(collection(db, "teachers"), where("email", "==", teacherEmail));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          alert("A teacher with this email already exists.");
          return;
        }
        const qEmp = query(collection(db, "teachers"), where("employeeId", "==", teacherEmpId));
        const snapEmp = await getDocs(qEmp);
        if (!snapEmp.empty) {
          alert("A teacher with this Employee ID already exists.");
          return;
        }
      }

      const teacherData = {
        name: teacherName,
        email: teacherEmail,
        employeeId: teacherEmpId,
        department: teacherDept,
        updatedAt: Date.now()
      };

      if (editingTeacherId) {
        await updateDoc(doc(db, "teachers", editingTeacherId), teacherData);
        alert("Teacher updated successfully");
      } else {
        await addDoc(collection(db, "teachers"), {
          ...teacherData,
          createdAt: Date.now()
        });
        alert("Teacher added successfully");
      }

      // Reset form
      setTeacherName("");
      setTeacherEmail("");
      setTeacherEmpId("");
      setEditingTeacherId(null);

      // Refresh list
      const snap = await getDocs(collection(db, "teachers"));
      setTeachersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
      // Check if subject code already exists
      const qCheck = query(collection(db, "subjects"), where("code", "==", subjectCode.trim()));
      const snapCheck = await getDocs(qCheck);
      if (!snapCheck.empty) {
        alert(`Subject code "${subjectCode.trim()}" already exists. Please use a unique code.`);
        return;
      }

      await addDoc(collection(db, "subjects"), {
        semester,
        name: subjectName.trim(),
        code: subjectCode.trim(),
        department,
        credits: Number(credits) || 0,
        teachingHours: Number(teachingHours) || 0,
        createdAt: Date.now()
      });
      alert("Subject added successfully.");
      // Clear fields and refetch
      setSubjectName("");
      setSubjectCode("");
      setDepartment("Computer Science");
      setCredits("");
      setTeachingHours("");
      // Refresh list
      const q = query(collection(db, "subjects"), where("semester", "==", semester));
      const snap = await getDocs(q);
      setSubjectsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Add subject error:", err);
      alert(`Add subject error: ${err.message || err}`);
    }
  };

  const handleSlotClick = (day, hour) => {
    const key = `${selectedClass}-${day}-${hour}`;
    const existingClass = timetableData[key];
    if (existingClass) {
      setSubject(existingClass.subject);
      setTeacher(existingClass.teacher);
      setRoom(existingClass.room);
    } else {
      setSubject("");
      setTeacher("");
      setRoom("");
    }
    setCurrentSlot(key);
    setShowForm(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const newTimetable = { ...timetableData };
    if (subject || teacher || room) {
      newTimetable[currentSlot] = { subject, teacher, room };
    } else {
      delete newTimetable[currentSlot];
    }
    setTimetableData(newTimetable);
    setShowForm(false);
    setCurrentSlot(null);
    setSubject("");
    setTeacher("");
    setRoom("");
  };

  const handleCancel = () => {
    setShowForm(false);
    setCurrentSlot(null);
    setSubject("");
    setTeacher("");
    setRoom("");
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
            Overview
          </li>
          <li
            className={activeMenu === "class-timetable" ? "active" : ""}
            onClick={() => setActiveMenu("class-timetable")}
          >
            Class Timetables
          </li>
          <li
            className={activeMenu === "teacher-timetable" ? "active" : ""}
            onClick={() => setActiveMenu("teacher-timetable")}
          >
            Teacher Timetables
          </li>
          <li
            className={activeMenu === "add-subject" ? "active" : ""}
            onClick={() => setActiveMenu("add-subject")}
          >
            <span className="menu-icon">➕</span> Add Subject
          </li>
          <li
            className={activeMenu === "teachers" ? "active" : ""}
            onClick={() => setActiveMenu("teachers")}
          >
            Teachers
          </li>
          <li
            className={activeMenu === "users" ? "active" : ""}
            onClick={() => setActiveMenu("users")}
          >
            Users
          </li>
        </ul>
        <button onClick={handleSignOut} className="sign-out-btn">
          Sign Out
        </button>
        {process.env.NODE_ENV !== 'production' && (
          <button
            onClick={() => {
              console.log('auth.currentUser:', auth.currentUser);
              console.log('firebaseConfig:', firebaseConfig);
              alert('Debug info logged to console');
            }}
            className="debug-btn"
          >
            Debug Info
          </button>
        )}
      </aside>

      {/* Main Content */}
      <main className="admin-content">
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

        {(activeMenu === "class-timetable" || activeMenu === "teacher-timetable") && (
          <div className="timetable-section">
            <h1>{activeMenu === "class-timetable" ? "Class Timetables" : "Teacher Timetables"}</h1>

            <div className="selector-section">
              {activeMenu === "class-timetable" ? (
                <div className="selector">
                  <label>Select Class:</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                  >
                    {classes.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="selector">
                  <label>Select Teacher:</label>
                  <select
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                  >
                    {teachers.map((teacher) => (
                      <option key={teacher} value={teacher}>{teacher}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Users list view */}
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
                      const key = activeMenu === "class-timetable"
                        ? `${selectedClass}-${day}-${hour}`
                        : `${selectedTeacher}-${day}-${hour}`;
                      const classInfo = timetableData[key];
                      return (
                        <td
                          key={key}
                          onClick={() => handleSlotClick(day, hour)}
                          className="timetable-cell"
                        >
                          {classInfo ? (
                            <div className="class-info">
                              <div className="subject">{classInfo.subject}</div>
                              <div className="teacher">{classInfo.teacher}</div>
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

            {showForm && (
              <div className="form-overlay">
                <div className="form-container">
                  <h2>Add/Edit Class</h2>
                  <form onSubmit={handleFormSubmit}>
                    <div className="form-group">
                      <label>Subject:</label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Enter subject"
                      />
                    </div>
                    <div className="form-group">
                      <label>Teacher:</label>
                      <input
                        type="text"
                        value={teacher}
                        onChange={(e) => setTeacher(e.target.value)}
                        placeholder="Enter teacher"
                      />
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
            <h1>Add Subject</h1>
            <div className="form-container" style={{ maxWidth: '700px' }}>
              <form onSubmit={handleAddSubjectSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Semester</label>
                    <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                      {Array.from({ length: 8 }, (_, i) => `Semester ${i + 1}`).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Subject Name</label>
                    <input type="text" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Subject name" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Department</label>
                    <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Subject Code</label>
                    <input type="text" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} placeholder="e.g. MATH101" />
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
                <div className="form-buttons">
                  <button type="submit">Add Subject</button>
                  <button type="button" onClick={() => { setSubjectName(''); setSubjectCode(''); setCredits(''); setTeachingHours(''); }}>Clear</button>
                </div>
              </form>
            </div>

            <div style={{ marginTop: 20 }}>
              <h2>Subjects in {semester}</h2>
              {loadingSubjects ? <p>Loading...</p> : subjectsList.length === 0 ? <p>No subjects for this semester.</p> : (
                <table className="subjects-table">
                  <thead>
                    <tr><th>Code</th><th>Name</th><th>Department</th><th>Credits</th><th>Hours</th></tr>
                  </thead>
                  <tbody>
                    {subjectsList.map(s => (
                      <tr key={s.id}>
                        <td>{s.code}</td>
                        <td>{s.name}</td>
                        <td>{s.department || ''}</td>
                        <td>{s.credits}</td>
                        <td>{s.teachingHours}</td>
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
                    }}>Cancel Edit</button>
                  )}
                </div>
              </form>
            </div>

            <div style={{ marginTop: 30 }}>
              <h2>All Teachers</h2>
              {loadingTeachers ? <p>Loading...</p> : (
                <table className="subjects-table">
                  <thead>
                    <tr><th>ID</th><th>Name</th><th>Email</th><th>Dept</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {teachersList.map(t => (
                      <tr key={t.id}>
                        <td>{t.employeeId}</td>
                        <td>{t.name}</td>
                        <td>{t.email}</td>
                        <td>{t.department}</td>
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

      </main>
    </div>
  );
};

export default AdminHomePage;