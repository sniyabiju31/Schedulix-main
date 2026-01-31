import React, { useState } from "react";
import "./AdminHome.css";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const hours = ["8AM", "9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM"];

const classes = ["Class 10A", "Class 10B", "Class 9A", "Class 9B", "Class 8A"];
const teachers = ["Mr. Smith", "Ms. Johnson", "Mr. Davis", "Ms. Wilson", "Mr. Brown"];

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
            className={activeMenu === "personal" ? "active" : ""}
            onClick={() => setActiveMenu("personal")}
          >
            Personal Details
          </li>
        </ul>
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

        {activeMenu === "personal" && (
          <div className="personal-section">
            <h1>Personal Details & Preferences</h1>
            <div className="personal-form">
              <div className="form-section">
                <h2>Personal Information</h2>
                <div className="form-row">
                  <div className="form-group">
                    <label>Name:</label>
                    <input type="text" defaultValue="Admin User" />
                  </div>
                  <div className="form-group">
                    <label>Email:</label>
                    <input type="email" defaultValue="admin@schedulix.com" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Phone:</label>
                    <input type="tel" defaultValue="+1-234-567-8900" />
                  </div>
                  <div className="form-group">
                    <label>Department:</label>
                    <input type="text" defaultValue="Administration" />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h2>Subject Preferences</h2>
                <div className="preferences-grid">
                  {["Mathematics", "Science", "English", "History", "Geography", "Art", "Physical Education", "Computer Science"].map((subj) => (
                    <label key={subj} className="preference-item">
                      <input type="checkbox" defaultChecked={Math.random() > 0.5} />
                      {subj}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-section">
                <h2>Class Preferences</h2>
                <div className="preferences-grid">
                  {classes.map((cls) => (
                    <label key={cls} className="preference-item">
                      <input type="checkbox" defaultChecked={Math.random() > 0.3} />
                      {cls}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button className="save-btn">Save Changes</button>
                <button className="cancel-btn">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminHomePage;