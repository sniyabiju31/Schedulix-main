import React, { useState, useEffect } from "react";
import "./home.css";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const hours = ["8AM", "9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM"];

const StaffHomePage = () => {
  const [activeMenu, setActiveMenu] = useState("timetable");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const docRef = doc(db, "staff", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUser(docSnap.data());
        }
      }
    });
    return unsubscribe;
  }, []);

  const handleSignOut = () => {
    auth.signOut();
    window.location.href = "/";
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
            Personal Details
          </li>
          <li
            className={activeMenu === "timetable" ? "active" : ""}
            onClick={() => setActiveMenu("timetable")}
          >
            My Timetable
          </li>
          <li
            className={activeMenu === "schedule" ? "active" : ""}
            onClick={() => setActiveMenu("schedule")}
          >
            Class Schedule
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
                  <label>Phone:</label>
                  <span>+1-234-567-8900</span>
                </div>
                <div className="info-item">
                  <label>Department:</label>
                  <span>Mathematics</span>
                </div>
                <div className="info-item">
                  <label>Employee ID:</label>
                  <span>STF001</span>
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
                        <span className="slot">Math 101</span>
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
                <h3>Monday</h3>
                <ul>
                  <li>8AM - Math 101 (Room 201)</li>
                  <li>9AM - Algebra (Room 201)</li>
                  <li>10AM - Geometry (Room 201)</li>
                  <li>11AM - Free Period</li>
                </ul>
              </div>
              <div className="schedule-card">
                <h3>Tuesday</h3>
                <ul>
                  <li>8AM - Math 101 (Room 201)</li>
                  <li>9AM - Calculus (Room 201)</li>
                  <li>10AM - Statistics (Room 201)</li>
                  <li>11AM - Free Period</li>
                </ul>
              </div>
              <div className="schedule-card">
                <h3>Wednesday</h3>
                <ul>
                  <li>8AM - Math 101 (Room 201)</li>
                  <li>9AM - Algebra (Room 201)</li>
                  <li>10AM - Free Period</li>
                  <li>11AM - Office Hours</li>
                </ul>
              </div>
              <div className="schedule-card">
                <h3>Thursday</h3>
                <ul>
                  <li>8AM - Math 101 (Room 201)</li>
                  <li>9AM - Geometry (Room 201)</li>
                  <li>10AM - Calculus (Room 201)</li>
                  <li>11AM - Free Period</li>
                </ul>
              </div>
              <div className="schedule-card">
                <h3>Friday</h3>
                <ul>
                  <li>8AM - Math 101 (Room 201)</li>
                  <li>9AM - Statistics (Room 201)</li>
                  <li>10AM - Free Period</li>
                  <li>11AM - Office Hours</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StaffHomePage;
