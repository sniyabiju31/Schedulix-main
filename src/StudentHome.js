import React, { useState, useEffect } from "react";
import "./home.css"; // Reuse staff styles for consistency or create student-specific later
import { auth, rtdb, db } from "./firebase";
import { ref, get, set, serverTimestamp } from "firebase/database";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { User, Calendar, CreditCard, Clock, LogOut } from "lucide-react";

const StudentHomePage = () => {
    const [activeMenu, setActiveMenu] = useState("timetable");
    const [user, setUser] = useState(null);
    const [timeWindow, setTimeWindow] = useState({ open: false, end: null });
    const [studentData, setStudentData] = useState({
        name: "",
        email: "",
        department: "",
        semester: "",
        phone: "",
        address: ""
    });
    const [feesData, setFeesData] = useState({ total: 0, paid: 0, pending: 0 });
    const [timetable, setTimetable] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (u) => {
            if (u) {
                // Fetch user role data
                const userRef = ref(rtdb, `users/${u.uid}`);
                const userSnap = await get(userRef);
                if (userSnap.exists()) {
                    const userData = userSnap.val();
                    setUser(userData);
                    setStudentData(prev => ({ ...prev, ...userData }));
                }

                // Fetch Time Window settings
                const settingsRef = ref(rtdb, "settings/student_update_window");
                const settingsSnap = await get(settingsRef);
                if (settingsSnap.exists()) {
                    const windowData = settingsSnap.val();
                    const now = Date.now();
                    setTimeWindow({
                        open: now >= windowData.start && now <= windowData.end,
                        end: windowData.end
                    });
                }

                // Fetch Fees Data
                const feesRef = ref(rtdb, `fees/${u.uid}`);
                const feesSnap = await get(feesRef);
                if (feesSnap.exists()) {
                    setFeesData(feesSnap.val());
                }

                // Fetch Timetable (Filter by department/semester)
                if (userSnap.exists()) {
                    const { department, semester } = userSnap.val();
                    const timetableRef = ref(rtdb, `timetables/${department}/${semester}`);
                    const ttSnap = await get(timetableRef);
                    if (ttSnap.exists()) {
                        setTimetable(ttSnap.val());
                    }
                }
                setLoading(false);
            } else {
                window.location.href = "/";
            }
        });
        return unsubscribe;
    }, []);

    const handleDataChange = (e) => {
        setStudentData({ ...studentData, [e.target.name]: e.target.value });
    };

    const handleDataSubmit = async (e) => {
        e.preventDefault();
        if (!timeWindow.open) {
            alert("The time window for updating details has closed.");
            return;
        }
        try {
            await set(ref(rtdb, `users/${auth.currentUser.uid}`), {
                ...user,
                ...studentData,
                updatedAt: Date.now()
            });
            alert("Details updated successfully!");
        } catch (error) {
            console.error("Error updating details:", error);
            alert("Failed to update details: " + error.message);
        }
    };

    const handleSignOut = async () => {
        await auth.signOut();
        window.location.href = "/";
    };

    if (loading) return <div className="loading">Loading...</div>;

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const hours = ["8AM", "9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM"];

    return (
        <div className="home-layout">
            <aside className="sidebar">
                <h2 className="logo">Schedulix Student</h2>
                <ul className="menu">
                    <li className={activeMenu === "profile" ? "active" : ""} onClick={() => setActiveMenu("profile")}>
                        <User size={20} className="menu-icon" /> Profile
                    </li>
                    <li className={activeMenu === "timetable" ? "active" : ""} onClick={() => setActiveMenu("timetable")}>
                        <Calendar size={20} className="menu-icon" /> Timetable
                    </li>
                    <li className={activeMenu === "fees" ? "active" : ""} onClick={() => setActiveMenu("fees")}>
                        <CreditCard size={20} className="menu-icon" /> Fees & Dues
                    </li>
                </ul>
                <button onClick={handleSignOut} className="sign-out-btn">
                    <LogOut size={20} className="menu-icon" /> Sign Out
                </button>
            </aside>

            <main className="content">
                {activeMenu === "profile" && (
                    <div className="profile-section">
                        <h1>Personal Details</h1>
                        {!timeWindow.open && (
                            <div className="alert-info">
                                <Clock size={16} /> Update window is closed. View-only mode.
                            </div>
                        )}
                        <form onSubmit={handleDataSubmit} className="student-form">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Name</label>
                                    <input name="name" value={studentData.name} onChange={handleDataChange} disabled={!timeWindow.open} />
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input name="email" value={studentData.email} disabled />
                                </div>
                                <div className="form-group">
                                    <label>Role</label>
                                    <input name="role" value={studentData.role || "Student"} disabled />
                                </div>
                                <div className="form-group">
                                    <label>Last Login</label>
                                    <input
                                        name="lastLogin"
                                        value={studentData.lastLogin ? new Date(studentData.lastLogin).toLocaleString() : "First login today"}
                                        disabled
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Department</label>
                                    <input name="department" value={studentData.department} disabled />
                                </div>
                                <div className="form-group">
                                    <label>Semester</label>
                                    <input name="semester" value={studentData.semester} disabled />
                                </div>
                                <div className="form-group">
                                    <label>Phone</label>
                                    <input name="phone" value={studentData.phone || ""} onChange={handleDataChange} disabled={!timeWindow.open} />
                                </div>
                                <div className="form-group">
                                    <label>Address</label>
                                    <textarea name="address" value={studentData.address || ""} onChange={handleDataChange} disabled={!timeWindow.open}></textarea>
                                </div>
                            </div>
                            {timeWindow.open && <button type="submit" className="save-btn">Save Changes</button>}
                        </form>
                    </div>
                )}

                {activeMenu === "timetable" && (
                    <div className="home-container">
                        <h1>Your Timetable</h1>
                        <table className="timetable">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    {days.map(day => <th key={day}>{day}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {hours.map(hour => (
                                    <tr key={hour}>
                                        <td>{hour}</td>
                                        {days.map(day => {
                                            const slot = timetable[day] && timetable[day][hour];
                                            return (
                                                <td key={day + hour} className={slot ? "has-class" : ""}>
                                                    {slot ? (
                                                        <div className="slot-info">
                                                            <span className="subject">{slot.subject}</span>
                                                            <span className="details">{slot.room}</span>
                                                        </div>
                                                    ) : "-"}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeMenu === "fees" && (
                    <div className="fees-section">
                        <h1>Fees & Financials</h1>
                        <div className="stats-grid">
                            <div className="stat-card">
                                <h3>Total Fees</h3>
                                <p>₹{feesData.total}</p>
                            </div>
                            <div className="stat-card danger">
                                <h3>Due Amount</h3>
                                <p>₹{feesData.pending}</p>
                            </div>
                            <div className="stat-card success">
                                <h3>Paid Amount</h3>
                                <p>₹{feesData.paid}</p>
                            </div>
                        </div>
                        {feesData.pending > 0 && (
                            <button className="pay-btn" onClick={() => alert("Redirecting to Payment Gateway...")}>
                                Pay Now
                            </button>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default StudentHomePage;
