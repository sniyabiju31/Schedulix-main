import React, { useState, useEffect } from "react";
import "./home.css"; // Reuse staff styles for consistency or create student-specific later
import { auth, rtdb, db, storage } from "./firebase";
import { ref, get, set, onValue, serverTimestamp } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { User, Calendar, CreditCard, Clock, LogOut, Edit3, Camera, PieChart, BarChart3 } from "lucide-react";

const ParentHomePage = () => {
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
        dob: "",
        fatherName: "",
        motherName: "",
        religion: "",
        caste: "",
        phone: "",
        guardianName: "",
        guardianAddress: "",
        address: "",
        photoURL: ""
    });
    const [feesData, setFeesData] = useState({ total: 0, paid: 0, pending: 0 });
    const [timetable, setTimetable] = useState({});
    const [attendanceData, setAttendanceData] = useState({});
    const [selectedSemester, setSelectedSemester] = useState("Semester 1");
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

                // Fetch Attendance Data
                const attendanceRef = ref(rtdb, `attendance/${u.uid}`);
                const attSnap = await get(attendanceRef);
                if (attSnap.exists()) {
                    setAttendanceData(attSnap.val());
                    // Auto-select current semester if available
                    if (userSnap.exists() && userSnap.val().semester) {
                        setSelectedSemester(userSnap.val().semester);
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

    const handlePhotoChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert("File size too large. Please select an image under 2MB.");
                return;
            }
            try {
                setLoading(true);
                const fileRef = storageRef(storage, `profile_photos/${auth.currentUser.uid}`);
                await uploadBytes(fileRef, file);
                const downloadURL = await getDownloadURL(fileRef);
                setStudentData(prev => ({ ...prev, photoURL: downloadURL }));
                alert("Photo uploaded successfully!");
            } catch (error) {
                console.error("Error uploading photo:", error);
                alert("Failed to upload photo: " + error.message);
            } finally {
                setLoading(false);
            }
        }
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
                <h2 className="logo">Schedulix Parent</h2>
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
                    <li className={activeMenu === "attendance" ? "active" : ""} onClick={() => setActiveMenu("attendance")}>
                        <PieChart size={20} className="menu-icon" /> Attendance
                    </li>
                </ul>
                <button onClick={handleSignOut} className="sign-out-btn">
                    <LogOut size={20} className="menu-icon" /> Sign Out
                </button>
            </aside>

            <main className="content">
                {activeMenu === "profile" && (
                    <div className="profile-section">
                        <div className="profile-top-card" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            marginBottom: '30px',
                            background: 'rgba(255,255,255,0.02)',
                            padding: '20px',
                            borderRadius: '16px',
                            border: '1px solid var(--glass-border)'
                        }}>
                            <div className="profile-avatar-container" style={{ position: 'relative' }}>
                                <div className="profile-avatar" style={{
                                    width: '120px',
                                    height: '120px',
                                    borderRadius: '50%',
                                    border: '3px solid var(--accent-violet)',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#1e293b'
                                }}>
                                    {studentData.photoURL ? (
                                        <img src={studentData.photoURL} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <User size={60} color="#94a3b8" />
                                    )}
                                </div>
                                {isEditMode && (
                                    <label htmlFor="photo-upload" className="photo-upload-label" style={{
                                        position: 'absolute',
                                        bottom: '5px',
                                        right: '5px',
                                        background: 'var(--accent-violet)',
                                        borderRadius: '50%',
                                        width: '35px',
                                        height: '35px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                                    }}>
                                        <Camera size={18} color="white" />
                                        <input
                                            id="photo-upload"
                                            type="file"
                                            accept="image/*"
                                            onChange={handlePhotoChange}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                )}
                            </div>
                            <h2 style={{ marginTop: '15px', marginBottom: '5px' }}>{studentData.name || "Student Name"}</h2>
                            <p style={{ color: '#94a3b8', margin: 0 }}>{studentData.rollNo || "Roll Number"}</p>
                        </div>

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
                                    <label>Date of Birth</label>
                                    <input
                                        type="date"
                                        name="dob"
                                        value={studentData.dob || ""}
                                        onChange={handleDataChange}
                                        disabled={!isEditMode}
                                        onClick={(e) => isEditMode && e.target.showPicker && e.target.showPicker()}
                                        style={{ cursor: isEditMode ? 'pointer' : 'default' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Father's Name</label>
                                    <input name="fatherName" value={studentData.fatherName || ""} onChange={handleDataChange} disabled={!isEditMode} placeholder="Father's Name" />
                                </div>
                                <div className="form-group">
                                    <label>Mother's Name</label>
                                    <input name="motherName" value={studentData.motherName || ""} onChange={handleDataChange} disabled={!isEditMode} placeholder="Mother's Name" />
                                </div>
                                <div className="form-group">
                                    <label>Religion</label>
                                    <input name="religion" value={studentData.religion || ""} onChange={handleDataChange} disabled={!isEditMode} placeholder="e.g. Hindu, Muslim, Christian" />
                                </div>
                                <div className="form-group">
                                    <label>Caste</label>
                                    <input name="caste" value={studentData.caste || ""} onChange={handleDataChange} disabled={!isEditMode} placeholder="Caste" />
                                </div>
                                <div className="form-group">
                                    <label>Guardian Name</label>
                                    <input name="guardianName" value={studentData.guardianName || ""} onChange={handleDataChange} disabled={!isEditMode} placeholder="Guardian Name" />
                                </div>
                                <div className="form-group">
                                    <label>Guardian Address</label>
                                    <input name="guardianAddress" value={studentData.guardianAddress || ""} onChange={handleDataChange} disabled={!isEditMode} placeholder="Guardian Address" />
                                </div>
                                <div className="form-group">
                                    <label>Address</label>
                                    <input name="address" value={studentData.address || ""} onChange={handleDataChange} disabled={!isEditMode} placeholder="Permanent Address" />
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

                {activeMenu === "attendance" && (
                    <div className="attendance-section">
                        <h1>Attendance Overview</h1>

                        <div className="filter-bar" style={{ marginBottom: '20px' }}>
                            <label>Select Semester:</label>
                            <select
                                value={selectedSemester}
                                onChange={(e) => setSelectedSemester(e.target.value)}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--glass-border)',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    color: 'var(--text-primary)',
                                    marginLeft: '10px'
                                }}
                            >
                                {["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"].map(sem => (
                                    <option key={sem} value={sem}>{sem}</option>
                                ))}
                            </select>
                        </div>

                        {attendanceData && attendanceData[selectedSemester] ? (
                            <>
                                {/* Total Attendance Card */}
                                <div className="stat-card" style={{ marginBottom: '30px', background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))' }}>
                                    <h3>Total Attendance</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '15px' }}>
                                        <div className="circular-progress" style={{
                                            width: '100px',
                                            height: '100px',
                                            position: 'relative',
                                            borderRadius: '50%',
                                            background: `conic-gradient(var(--accent-violet) ${(() => {
                                                const subjects = attendanceData[selectedSemester];
                                                const total = Object.values(subjects).reduce((acc, curr) => acc + (curr.total || 0), 0);
                                                const attended = Object.values(subjects).reduce((acc, curr) => acc + (curr.attended || 0), 0);
                                                return total > 0 ? (attended / total) * 100 : 0;
                                            })()}%, rgba(255,255,255,0.1) 0)`
                                        }}>
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#0f172a', width: '80%', height: '80%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                                {(() => {
                                                    const subjects = attendanceData[selectedSemester];
                                                    const total = Object.values(subjects).reduce((acc, curr) => acc + (curr.total || 0), 0);
                                                    const attended = Object.values(subjects).reduce((acc, curr) => acc + (curr.attended || 0), 0);
                                                    return total > 0 ? ((attended / total) * 100).toFixed(1) : "0.0";
                                                })()}%
                                            </div>
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500' }}>Overall Performance</p>
                                            <p style={{ margin: '5px 0 0 0', color: '#94a3b8' }}>
                                                {(() => {
                                                    const subjects = attendanceData[selectedSemester];
                                                    const total = Object.values(subjects).reduce((acc, curr) => acc + (curr.total || 0), 0);
                                                    const attended = Object.values(subjects).reduce((acc, curr) => acc + (curr.attended || 0), 0);
                                                    return `${attended} / ${total} Classes Attended`;
                                                })()}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Subject-wise Breakdown */}
                                <h3>Subject-wise Breakdown</h3>
                                <div className="subjects-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: '15px' }}>
                                    {Object.entries(attendanceData[selectedSemester]).map(([subject, data]) => {
                                        const percentage = data.total > 0 ? (data.attended / data.total) * 100 : 0;
                                        const color = percentage >= 75 ? '#22c55e' : percentage >= 60 ? '#eab308' : '#ef4444';

                                        return (
                                            <div key={subject} className="subject-card" style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                padding: '20px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--glass-border)'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                    <h4 style={{ margin: 0 }}>{subject}</h4>
                                                    <span style={{ color: color, fontWeight: 'bold' }}>{percentage.toFixed(1)}%</span>
                                                </div>
                                                <div className="progress-bar" style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                                                    <div style={{ width: `${percentage}%`, height: '100%', background: color, transition: 'width 0.5s ease' }}></div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#94a3b8' }}>
                                                    <span>Attended: <strong>{data.attended}</strong></span>
                                                    <span>Total: <strong>{data.total}</strong></span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className="no-data" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                <BarChart3 size={40} style={{ marginBottom: '15px', opacity: 0.5 }} />
                                <p>No attendance records found for {selectedSemester}.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default ParentHomePage;
