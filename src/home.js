import React, { useState, useEffect } from "react";
import "./home.css";
import { auth, db } from "./firebase";
import { doc, getDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { User, Calendar, FileText, Star } from "lucide-react";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const hours = ["8AM", "9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM"];
const departments = ["Computer Science", "Electronics & Communication", "Mechanical Engineering", "Civil Engineering", "Electrical & Electronics", "Information Technology", "Artificial Intelligence", "Cyber Security"];

const StaffHomePage = () => {
  const [activeMenu, setActiveMenu] = useState("timetable");
  const [user, setUser] = useState(null);

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

  const handlePrefChange = (e) => {
    setPrefForm({ ...prefForm, [e.target.name]: e.target.value });
  };

  const handlePreferenceSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setLoadingPref(true);
    try {
      await addDoc(collection(db, "preferences"), {
        ...prefForm,
        teacherUid: auth.currentUser.uid,
        teacherEmpId: user.employeeId,
        teacherName: user.name,
        teacherEmail: user.email,
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
      setActiveMenu("timetable"); // Go back to timetable or stay
    } catch (error) {
      console.error("Error submitting preferences:", error);
      alert("Error submitting preferences: " + error.message);
    } finally {
      setLoadingPref(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      try {
        if (user) {
          const docRef = doc(db, "staff", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUser(docSnap.data());
          } else {
            console.warn("Staff document not found for user:", user.uid);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth onAuthStateChanged error (staff):", error);
        alert(`${error.code || "auth/error"}: ${error.message}`);
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
          <li
            className={activeMenu === "preferences" ? "active" : ""}
            onClick={() => setActiveMenu("preferences")}
          >
            <Star size={20} className="menu-icon" /> Subject Preferences
          </li>
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
              </div>
            </div>
          </div>
        )}

        {activeMenu === "timetable" && (
          <div className="home-container">
            <h1>My Teaching Timetable</h1>
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
                    {days.map((day) => (
                      <td
                        key={day + hour}
                        onClick={() => alert(`Class: ${day} at ${hour}`)}
                      >
                        <span className="slot"></span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
                    <input name="subjectPref1" value={prefForm.subjectPref1} onChange={handlePrefChange} required placeholder="e.g. Data Structures" />
                  </div>
                  <div className="form-group">
                    <label>Preference 2</label>
                    <input name="subjectPref2" value={prefForm.subjectPref2} onChange={handlePrefChange} placeholder="e.g. Algorithms" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Preference 3</label>
                    <input name="subjectPref3" value={prefForm.subjectPref3} onChange={handlePrefChange} placeholder="e.g. Database" />
                  </div>
                </div>

                <h3>Class Preferences</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Class Pref 1</label>
                    <input name="classPref1" value={prefForm.classPref1} onChange={handlePrefChange} required placeholder="e.g. Class 10A" />
                  </div>
                  <div className="form-group">
                    <label>Class Pref 2</label>
                    <input name="classPref2" value={prefForm.classPref2} onChange={handlePrefChange} placeholder="e.g. Class 9B" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Class Pref 3</label>
                    <input name="classPref3" value={prefForm.classPref3} onChange={handlePrefChange} placeholder="e.g. Class 8A" />
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
      </main>
    </div>
  );
};

export default StaffHomePage;
