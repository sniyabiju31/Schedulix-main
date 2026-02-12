import React, { useState, useEffect } from "react";
import "./home.css"; // Reuse staff styles for consistency or create student-specific later
import { auth, rtdb, db } from "./firebase";
import { ref, get, set, onValue, serverTimestamp } from "firebase/database";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { User, Calendar, CreditCard, Clock, LogOut, Edit3 } from "lucide-react";

const StudentHomePage = () => {
    const [activeMenu, setActiveMenu] = useState("timetable");
    const [user, setUser] = useState(null);
    const [timeWindow, setTimeWindow] = useState({ open: false, end: null });
    const [isEditMode, setIsEditMode] = useState(false);
    const [studentData, setStudentData] = useState({
        name: "",
        email: "",
        department: "",
        semester: "",
        division: "",
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

                // Real-time Settings Listener
                const settingsRef = ref(rtdb, "settings/student_update_window");
                const settingsUnsubscribe = onValue(settingsRef, (snapshot) => {
                    if (snapshot.exists()) {
                        const windowData = snapshot.val();
                        const now = Date.now();
                        const isWithinWindow = now >= windowData.start && now <= windowData.end;
                        const isManuallyUnlocked = windowData.isUnlocked || false;
                        const isOpen = isWithinWindow || isManuallyUnlocked;

                        setTimeWindow({
                            open: isOpen,
                            end: windowData.end
                        });

                        // If it closes while we are editing, force exit edit mode
                        if (!isOpen) {
                            setIsEditMode(false);
                        }
                    }
                });

                // Fetch Fees Data
                const feesRef = ref(rtdb, `fees/${u.uid}`);
                const feesSnap = await get(feesRef);
                if (feesSnap.exists()) {
                    setFeesData(feesSnap.val());
                }

                // Fetch Timetable (Filter by department/semester/division)
                if (userSnap.exists()) {
                    const { department, semester, division } = userSnap.val();
                    // Default to 'A' if division is not set
                    const div = division || 'A';
                    const timetableRef = ref(rtdb, `timetables/${department}/${semester}/${div}`);
                    const ttSnap = await get(timetableRef);
                    if (ttSnap.exists()) {
                        setTimetable(ttSnap.val());
                    }
                }
                setLoading(false);
                return () => settingsUnsubscribe();
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
    const hours = ["9:00-9:50", "9:50-10:40", "10:50-11:40", "11:40-12:30", "1:20-2:10", "2:20-3:10", "3:10-4:00"];

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
                        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h1 style={{ margin: 0 }}>Personal Details</h1>
                            {timeWindow.open && (
                                <button
                                    className={`edit-toggle-btn ${isEditMode ? 'active' : ''}`}
                                    onClick={() => setIsEditMode(!isEditMode)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        border: isEditMode ? '1px solid var(--accent-violet)' : '1px solid var(--glass-border)',
                                        background: isEditMode ? 'rgba(188, 19, 254, 0.1)' : 'rgba(255,255,255,0.05)',
                                        color: isEditMode ? 'var(--accent-violet)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        fontWeight: '600'
                                    }}
                                >
                                    <Edit3 size={18} /> {isEditMode ? "Cancel Editing" : "Edit Profile"}
                                </button>
                            )}
                        </div>

                        {!timeWindow.open && (
                            <div className="alert-info">
                                <Clock size={16} /> Update window is closed. View-only mode.
                            </div>
                        )}
                        {timeWindow.open && !isEditMode && (
                            <div className="alert-info success" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                <Edit3 size={16} /> Editing is enabled. Click 'Edit Profile' to make changes.
                            </div>
                        )}

                        <form onSubmit={handleDataSubmit} className="student-form">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Name</label>
                                    <input name="name" value={studentData.name} onChange={handleDataChange} disabled={!isEditMode} />
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
                                    <label>Division</label>
                                    <select
                                        name="division"
                                        value={studentData.division || "A"}
                                        onChange={handleDataChange}
                                        disabled={!isEditMode}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--glass-border)',
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            color: 'var(--text-primary)'
                                        }}
                                    >
                                        {Array.from({ length: 5 }, (_, i) => String.fromCharCode(65 + i)).map(div => (
                                            <option key={div} value={div}>Division {div}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Phone</label>
                                    <input name="phone" value={studentData.phone || ""} onChange={handleDataChange} disabled={!isEditMode} />
                                </div>
                                <div className="form-group">
                                    <label>Address</label>
                                    <textarea name="address" value={studentData.address || ""} onChange={handleDataChange} disabled={!isEditMode}></textarea>
                                </div>
                            </div>
                            {isEditMode && <button type="submit" className="save-btn">Save Changes</button>}
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
