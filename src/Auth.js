import React, { useState } from "react";
import "./auth.css";
import { auth, db, rtdb } from "./firebase";
// Using Realtime Database for signup/login instead of Firebase Auth account creation
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { ref, set as rtdbSet, get as rtdbGet, serverTimestamp as rtdbServerTimestamp, push, query as rtdbQuery, orderByChild, equalTo } from "firebase/database";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, fetchSignInMethodsForEmail, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";

export default function Auth() {
  const [mode, setMode] = useState("login"); // login, signup, activate
  const [role, setRole] = useState("admin");
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    employeeId: "", // For first time login
    department: "Computer Science", // Default
  });
  const [showPassword, setShowPassword] = useState(false);

  function onChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const { email, password, name, username, department } = form; // Added department

    try {
      if (mode === "activate") {
        // FIRST TIME USER LOGIN (Staff or Student)
        const { email, employeeId, password } = form; // employeeId is used for Roll Number/ID too
        const idField = role === "staff" ? "employeeId" : "registerNo";
        const roleLabel = role === "staff" ? "Staff" : role === "parent" ? "Parent" : "Student";
        let recordData = null;

        if (role === "parent") {
          // Parent logic: Verify that the child (student) exists by Roll Number (employeeId field)
          const studentRef = ref(rtdb, "students");
          const qStudent = rtdbQuery(studentRef, orderByChild("registerNo"), equalTo(employeeId));
          const snapStudent = await rtdbGet(qStudent);

          if (!snapStudent.exists()) {
            alert(`No student found with Register Number: ${employeeId}. Please check the number or contact Admin.`);
            return;
          }

          const studentsDataMap = snapStudent.val();
          const studentKey = Object.keys(studentsDataMap)[0];
          const studentData = studentsDataMap[studentKey] || {};

          recordData = {
            registerNo: studentData.registerNo || employeeId,
            studentUid: studentData.uid || studentKey || "", 
            studentName: studentData.name || "Unknown",
            studentRegNo: studentData.registerNo || employeeId,
            email: email, 
            name: `Parent of ${studentData.name || "Unknown"}`,
            role: "parent",
            department: studentData.department || "",
            semester: studentData.semester || "",
            division: studentData.division || "A"
          };
        } else {
          // Staff/Student logic: Verify pre-registered email record
          const collectionName = role === "staff" ? "teachers" : "students";
          const queryRef = rtdbQuery(ref(rtdb, collectionName), orderByChild("email"), equalTo(email));
          const snap = await rtdbGet(queryRef);

          if (!snap.exists()) {
            alert(`No ${roleLabel} record found with this Email. Please contact Admin.`);
            return;
          }

          const itemsData = snap.val();
          const itemKey = Object.keys(itemsData).find(key => itemsData[key][idField] === employeeId);

          if (!itemKey) {
            alert(`${role === "staff" ? "Employee ID" : "Roll Number"} does not match our records for this email.`);
            return;
          }
          recordData = itemsData[itemKey];
        }

        try {
          // 2. Create Auth Account
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          // 3. Create Firestore Profile
          await setDoc(doc(db, role, user.uid), {
            ...recordData,
            username: recordData[idField],
            role: role,
            createdAt: serverTimestamp(),
            activatedAt: serverTimestamp()
          });

          // 4. Create RTDB User Profile
          await rtdbSet(ref(rtdb, `users/${user.uid}`), {
            name: recordData.name,
            username: recordData[idField],
            email: recordData.email,
            role: role,
            studentUid: recordData.studentUid,
            studentName: recordData.studentName,
            studentRegNo: recordData.studentRegNo,
            createdAt: rtdbServerTimestamp(),
          });

          // 5. Role-specific node
          await rtdbSet(ref(rtdb, `${role}s/${user.uid}`), {
            name: recordData.name,
            email: recordData.email,
            role: role,
            createdAt: rtdbServerTimestamp(),
          });

          // Initialize Fees if student
          if (role === "student") {
            const feesRef = ref(rtdb, `fees/${user.uid}`);
            const feesSnap = await rtdbGet(feesRef);
            if (!feesSnap.exists()) {
              await rtdbSet(feesRef, {
                total: recordData.totalFees || 0,
                paid: 0,
                pending: recordData.totalFees || 0
              });
            }
          }

          // Record login
          await rtdbSet(ref(rtdb, `users/${user.uid}/lastLogin`), rtdbServerTimestamp());
          if (role === "student") {
            await rtdbSet(ref(rtdb, `students/${user.uid}/lastLogin`), rtdbServerTimestamp());
          }

          alert("Account activated successfully! You can now login.");
          setMode("login");
        } catch (authErr) {
          if (authErr.code === 'auth/email-already-in-use') {
            await signInWithEmailAndPassword(auth, email, password);
            const user = auth.currentUser;

            await setDoc(doc(db, role, user.uid), {
              ...recordData,
              username: recordData[idField],
              role: role,
              updatedAt: serverTimestamp(),
              activatedAt: serverTimestamp()
            }, { merge: true });

            await rtdbSet(ref(rtdb, `users/${user.uid}`), {
              name: recordData.name,
              username: recordData[idField],
              email: recordData.email,
              role: role,
              updatedAt: rtdbServerTimestamp(),
            }, { merge: true });

            // alert("Account activation confirmed! Logging you in...");
            window.location.href = role === "admin" ? "/admin-home" : role === "staff" ? "/staff-home" : role === "parent" ? "/parent-home" : "/student-home";
          } else {
            throw authErr;
          }
        }

        // ... (existing activate logic)
        // ...
      } else if (mode === "signup") {
        // ... (existing signup checks)

        // Create Firebase Auth account (secure password handling)
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userRole = role;

        // Debug: log the created user
        console.log('Created Firebase Auth user:', user.uid, { email, name, username, role: userRole, department });

        // Store metadata in Firestore for role-based access
        await setDoc(doc(db, userRole, user.uid), {
          name,
          username,
          email,
          role: userRole,
          department, // Save department
          createdAt: serverTimestamp(),
        });

        // Ensure auth state has settled so RTDB sees the authenticated user
        await new Promise(resolve => {
          const unsub = onAuthStateChanged(auth, u => {
            if (u && u.uid === user.uid) {
              console.log('onAuthStateChanged: confirmed auth for', u.uid);
              unsub();
              resolve();
            }
          });
        });

        // Force token refresh (best-effort) before writing to RTDB
        try {
          if (auth && auth.currentUser) {
            await auth.currentUser.getIdToken(true);
          }
        } catch (tokErr) {
          console.warn('getIdToken(true) failed:', tokErr);
        }

        // Also save user details to the Realtime Database (without password) with debug and error handling
        try {
          console.log(`RTDB: writing users/${user.uid} (auth uid: ${auth.currentUser ? auth.currentUser.uid : 'null'})`);
          await rtdbSet(ref(rtdb, `users/${user.uid}`), {
            name,
            username,
            email,
            role: userRole,
            department, // Save department
            createdAt: rtdbServerTimestamp(),
            lastLogin: rtdbServerTimestamp(),
          });
          console.log(`RTDB: users/${user.uid} write OK`);
        } catch (rtdbErr) {
          console.error('RTDB write error (users):', rtdbErr);
          alert(`RTDB write error (users): ${rtdbErr.code || ''} ${rtdbErr.message || JSON.stringify(rtdbErr)}`);
        }

        // also keep a role-specific node for quick lookup (e.g., admins/{uid} or staffs/{uid})
        try {
          console.log(`RTDB: writing ${userRole}s/${user.uid}`);
          await rtdbSet(ref(rtdb, `${userRole}s/${user.uid}`), {
            name,
            username,
            email,
            role: userRole,
            createdAt: rtdbServerTimestamp(),
          });
          console.log(`RTDB: ${userRole}s/${user.uid} write OK`);
        } catch (rtdbErr) {
          console.error(`RTDB write error (${userRole} node):`, rtdbErr);
          alert(`RTDB write error (${userRole} node): ${rtdbErr.code || ''} ${rtdbErr.message || JSON.stringify(rtdbErr)}`);
        }

        // Diagnostic test write to check RTDB permissions and connectivity
        try {
          console.log(`RTDB: writing test_connection/${user.uid}`);
          await rtdbSet(ref(rtdb, `test_connection/${user.uid}`), {
            ok: true,
            ts: Date.now(),
          });
          console.log(`RTDB: test_connection/${user.uid} write OK`);
        } catch (testErr) {
          console.error('RTDB test write error:', testErr);
          alert(`RTDB test write error: ${testErr.code || ''} ${testErr.message || JSON.stringify(testErr)}`);
        }

        // Push a chronological signup audit record (useful for admin dashboards/auditing)
        try {
          const newSignupRef = push(ref(rtdb, 'signups'));
          await rtdbSet(newSignupRef, {
            uid: user.uid,
            name,
            username,
            email,
            role: userRole,
            createdAt: rtdbServerTimestamp(),
          });
          console.log('RTDB: signups push OK', newSignupRef.key);
        } catch (signupAuditErr) {
          console.error('RTDB signups push error:', signupAuditErr);
          // Non-blocking — audit failure shouldn't block signup
        }

        // alert(`Signed up as ${userRole.toUpperCase()} — stored in '${userRole}' collection and RTDB.`);
        if (userRole === "admin") window.location.href = "/admin-home";
        else if (userRole === "staff") window.location.href = "/staff-home";
        else if (userRole === "parent") window.location.href = "/parent-home";
        else window.location.href = "/student-home";
      } else {
        // Login using Firebase Authentication
        await signInWithEmailAndPassword(auth, email, password);
        const user = auth.currentUser;
        if (user) {
          // AUTO ROLE DETECTION: Check selected role first, then fallback
          const checkRole = async (r) => {
            const docRef = doc(db, r, user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) return true;

            const rtdbUserSnap = await rtdbGet(ref(rtdb, `users/${user.uid}`));
            if (rtdbUserSnap.exists() && rtdbUserSnap.val().role === r) return true;

            const roleNodeSnap = await rtdbGet(ref(rtdb, `${r}s/${user.uid}`));
            return roleNodeSnap.exists();
          };

          const isAuthorized = await checkRole(role);
          const roles = ["admin", "staff", "student"];
          const otherRoles = roles.filter(r => r !== role);

          if (isAuthorized) {
            // Update last login in RTDB
            await rtdbSet(ref(rtdb, `users/${user.uid}/lastLogin`), rtdbServerTimestamp());
            if (role === "student") {
              await rtdbSet(ref(rtdb, `students/${user.uid}/lastLogin`), rtdbServerTimestamp());
            }

            // alert(`${role} login successful ✅`);
            if (role === "admin") window.location.href = "/admin-home";
            else if (role === "staff") window.location.href = "/staff-home";
            else if (role === "parent") window.location.href = "/parent-home";
            else window.location.href = "/student-home";
          } else {
            let foundRole = null;
            for (const r of otherRoles) {
              if (await checkRole(r)) {
                foundRole = r;
                break;
              }
            }


            if (foundRole) {
              // alert(`Logged in as ${foundRole} (you selected ${role}) ✅`);
              if (foundRole === "admin") window.location.href = "/admin-home";
              else if (foundRole === "staff") window.location.href = "/staff-home";
              else if (foundRole === "parent") window.location.href = "/parent-home";
              else window.location.href = "/student-home";
            } else {
              // AUTO-ACTIVATION: Check if they are in the teachers/ list but profiles are missing
              console.log("Checking for auto-activation...");
              const teachersRef = ref(rtdb, 'teachers');
              const q = rtdbQuery(teachersRef, orderByChild("email"), equalTo(email));
              const snap = await rtdbGet(q);

              if (snap.exists()) {
                const teachersData = snap.val();
                const teacherKey = Object.keys(teachersData)[0];
                const teacherData = teachersData[teacherKey];

                console.log("Auto-activating teacher profiles...");
                await setDoc(doc(db, "staff", user.uid), {
                  name: teacherData.name,
                  email: teacherData.email,
                  role: "staff",
                  employeeId: teacherData.employeeId,
                  department: teacherData.department,
                  createdAt: serverTimestamp(),
                  activatedAt: serverTimestamp()
                });
                const userData = {
                  name: teacherData.name,
                  username: teacherData.employeeId,
                  email: teacherData.email,
                  role: "staff",
                  createdAt: rtdbServerTimestamp(),
                };
                await rtdbSet(ref(rtdb, `users/${user.uid}`), userData);
                await rtdbSet(ref(rtdb, `staffs/${user.uid}`), userData);

                // alert("Your account has been automatically activated. Welcome!");
                window.location.href = "/staff-home";
              } else {
                // Try students
                const studentsRef = ref(rtdb, 'students');
                const qStudent = rtdbQuery(studentsRef, orderByChild("email"), equalTo(email));
                const snapStudent = await rtdbGet(qStudent);

                if (snapStudent.exists()) {
                  const studentsData = snapStudent.val();
                  const studentKey = Object.keys(studentsData)[0];
                  const studentData = studentsData[studentKey];

                  console.log("Auto-activating student profiles...");
                  await setDoc(doc(db, "student", user.uid), {
                    name: studentData.name,
                    email: studentData.email,
                    role: "student",
                    registerNo: studentData.registerNo,
                    department: studentData.department,
                    semester: studentData.semester,
                    createdAt: serverTimestamp(),
                    activatedAt: serverTimestamp()
                  });
                  const userData = {
                    name: studentData.name,
                    username: studentData.registerNo,
                    email: studentData.email,
                    role: "student",
                    createdAt: rtdbServerTimestamp(),
                  };
                  await rtdbSet(ref(rtdb, `users/${user.uid}`), userData);
                  await rtdbSet(ref(rtdb, `students/${user.uid}`), userData);

                  // Initialize Fees if not present
                  const feesRef = ref(rtdb, `fees/${user.uid}`);
                  const feesSnap = await rtdbGet(feesRef);
                  if (!feesSnap.exists()) {
                    await rtdbSet(feesRef, {
                      total: studentData.totalFees || 0,
                      paid: 0,
                      pending: studentData.totalFees || 0
                    });
                  }

                  await rtdbSet(ref(rtdb, `users/${user.uid}/lastLogin`), rtdbServerTimestamp());
                  await rtdbSet(ref(rtdb, `students/${user.uid}/lastLogin`), rtdbServerTimestamp());

                  // alert("Your student account has been automatically activated. Welcome!");
                  window.location.href = "/student-home";
                } else {
                  alert(`You are not authorized! ❌`);
                  await auth.signOut();
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Auth error:", error);
      // Show full error details to help debugging (code + message + full object if needed)
      const errCode = error && error.code ? error.code : "error";
      const errMessage = error && error.message ? error.message : JSON.stringify(error);
      alert(`Signup/Login error — ${errCode}: ${errMessage}`);
    }
  }

  const handleForgotPassword = async () => {
    if (!form.email) {
      alert("Please enter your email address first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, form.email);
      alert("Password reset email sent! Check your inbox.");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-card">
        <h2>{mode === "login" ? "Welcome Back" : "Create Account"}</h2>

        <div className="auth-toggle">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Login
          </button>

          {role === "admin" && (
            <button
              className={mode === "signup" ? "active" : ""}
              onClick={() => setMode("signup")}
            >
              Signup
            </button>
          )}


          {(role === "staff" || role === "student" || role === "parent") && (
            <button
              className={mode === "activate" ? "active" : ""}
              onClick={() => setMode("activate")}
            >
              First Time Login
            </button>
          )}
        </div>

        <div className="role-toggle">
          <label>
            <input
              type="radio"
              checked={role === "admin"}
              onChange={() => setRole("admin")}
            />
            Admin
          </label>
          <label>
            <input
              type="radio"
              checked={role === "staff"}
              onChange={() => setRole("staff")}
            />
            Staff
          </label>
          <label>
            <input
              type="radio"
              checked={role === "student"}
              onChange={() => setRole("student")}
            />
            Student
          </label>
          <label>
            <input
              type="radio"
              checked={role === "parent"}
              onChange={() => setRole("parent")}
            />
            Parent
          </label>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && (
            <>
              <div className="field">
                <label>Name</label>
                <input name="name" value={form.name} onChange={onChange} required placeholder="Full Name" />
              </div>

              <div className="field">
                <label>Username</label>
                <input name="username" value={form.username} onChange={onChange} required placeholder="Choose a username" />
              </div>

              <div className="field">
                <label>Email</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={onChange}
                  required
                  placeholder="email@example.com"
                />
              </div>

              <div className="field">
                <label>Department</label>
                <select name="department" value={form.department} onChange={onChange} required>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Electronics & Communication">Electronics & Communication</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Civil Engineering">Civil Engineering</option>
                  <option value="Electrical & Electronics">Electrical & Electronics</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Artificial Intelligence">Artificial Intelligence</option>
                  <option value="Cyber Security">Cyber Security</option>
                </select>
              </div>

              <div className="field">
                <label>Password</label>
                <div className="password-input-container">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={onChange}
                    required
                    placeholder="Minimum 6 characters"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {mode === "activate" && (
            <>
              <div className="field">
                <label>Email</label>
                <input name="email" type="email" value={form.email} onChange={onChange} required />
              </div>
              <div className="field">
                <label>{role === "staff" ? "Employee ID" : role === "parent" ? "Student Register Number" : "Register Number"}</label>
                <input name="employeeId" value={form.employeeId} onChange={onChange} required placeholder={role === "parent" ? "Student's Register Number" : "Provided by Admin"} />
              </div>
              <div className="field">
                <label>New Password</label>
                <div className="password-input-container">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={onChange}
                    required
                    minLength="6"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {mode === "login" && (
            <>
              <div className="field">
                <label>Email</label>
                <input
                  key="login-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={onChange}
                  required
                  autoFocus
                />
              </div>

              <div className="field">
                <label>Password</label>
                <div className="password-input-container">
                  <input
                    key="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={onChange}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <span
                  onClick={handleForgotPassword}
                  style={{ fontSize: '0.85em', color: '#007bff', cursor: 'pointer', marginTop: '5px', display: 'block' }}
                >
                  Forgot Password?
                </span>
              </div>
            </>
          )}

          <button type="submit" className="submit">
            {mode === "login" ? `Login as ${role}` : mode === "activate" ? "Activate Account" : `Sign up as ${role}`}
          </button>
        </form>
      </div>
    </div>
  );
}
