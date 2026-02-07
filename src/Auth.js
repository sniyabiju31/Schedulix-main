import React, { useState } from "react";
import "./auth.css";
import { auth, db, rtdb } from "./firebase";
// Using Realtime Database for signup/login instead of Firebase Auth account creation
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { ref, set as rtdbSet, get as rtdbGet, serverTimestamp as rtdbServerTimestamp, push, query as rtdbQuery, orderByChild, equalTo } from "firebase/database";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, fetchSignInMethodsForEmail, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";

export default function Auth() {
  const [mode, setMode] = useState("login"); // login, signup, activate
  const [role, setRole] = useState("admin");
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    employeeId: "", // For first time login
  });

  function onChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const { email, password, name, username } = form;

    try {
      if (mode === "activate") {
        // FIRST TIME TEACHER LOGIN
        const { email, employeeId, password } = form;

        // 1. Verify existence in teachers collection (RTDB)
        const teachersRef = ref(rtdb, 'teachers');
        const qEmail = rtdbQuery(teachersRef, orderByChild("email"), equalTo(email));
        const snapEmail = await rtdbGet(qEmail);

        if (!snapEmail.exists()) {
          alert("No teacher found with this Email. Please contact Admin.");
          return;
        }

        // RTDB queries return a map of matching children. We need to find the one with matching employeeId.
        const teachersData = snapEmail.val();
        const teacherKey = Object.keys(teachersData).find(key => teachersData[key].employeeId === employeeId);

        if (!teacherKey) {
          alert("Employee ID does not match the record for this Email. Please contact Admin.");
          return;
        }

        const teacherData = teachersData[teacherKey];

        try {
          // 2. Create Auth Account
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          // 3. Create Staff Profile (so they can login as staff)
          await setDoc(doc(db, "staff", user.uid), {
            name: teacherData.name,
            email: teacherData.email,
            role: "staff",
            employeeId: teacherData.employeeId,
            department: teacherData.department,
            createdAt: serverTimestamp(),
            activatedAt: serverTimestamp()
          });

          // 4. Also user profile in RTDB for consistency
          await rtdbSet(ref(rtdb, `users/${user.uid}`), {
            name: teacherData.name,
            email: teacherData.email,
            role: "staff",
            createdAt: rtdbServerTimestamp(),
          });

          alert("Account activated successfully! You can now login as Staff.");
          setMode("login");
          setRole("staff");
        } catch (authErr) {
          if (authErr.code === 'auth/email-already-in-use') {
            // If email exists, they might have been pre-created or already reset password.
            // Try to sign in instead.
            console.log("Email already in use, attempting to sign in instead for activation.");
            await signInWithEmailAndPassword(auth, email, password);
            const user = auth.currentUser;

            // Ensure profiles exist even if they were stuck
            await setDoc(doc(db, "staff", user.uid), {
              name: teacherData.name,
              email: teacherData.email,
              role: "staff",
              employeeId: teacherData.employeeId,
              department: teacherData.department,
              updatedAt: serverTimestamp(),
              activatedAt: serverTimestamp()
            }, { merge: true });

            await rtdbSet(ref(rtdb, `users/${user.uid}`), {
              name: teacherData.name,
              email: teacherData.email,
              role: "staff",
              updatedAt: rtdbServerTimestamp(),
            });

            alert("Account activation confirmed! Logging you in...");
            window.location.href = "/staff-home";
          } else {
            throw authErr;
          }
        }

      } else if (mode === "signup") {
        // Prevent creating a new account when the email is already registered
        const existingMethods = await fetchSignInMethodsForEmail(auth, email);
        if (existingMethods && existingMethods.length > 0) {
          if (existingMethods.includes("password")) {
            alert("An account with this email already exists. Try logging in or use Reset Password.");
          } else {
            alert(
              `An account already exists using provider(s): ${existingMethods.join(", ")}. Use that provider to sign in or reset your password.`
            );
          }
          return;
        }

        // Create Firebase Auth account (secure password handling)
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userRole = role;

        // Debug: log the created user
        console.log('Created Firebase Auth user:', user.uid, { email, name, username, role: userRole });

        // Store metadata in Firestore for role-based access
        await setDoc(doc(db, userRole, user.uid), {
          name,
          username,
          email,
          role: userRole,
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
            createdAt: rtdbServerTimestamp(),
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

        alert(`Signed up as ${userRole.toUpperCase()} — stored in '${userRole}' collection and RTDB.`);
        window.location.href = userRole === "admin" ? "/admin-home" : "/staff-home";
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
          const otherRole = role === "admin" ? "staff" : "admin";

          if (isAuthorized) {
            alert(`${role} login successful ✅`);
            window.location.href = role === "admin" ? "/admin-home" : "/staff-home";
          } else if (await checkRole(otherRole)) {
            alert(`Logged in as ${otherRole} (you selected ${role}) ✅`);
            window.location.href = otherRole === "admin" ? "/admin-home" : "/staff-home";
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
              // Create Firestore Staff Profile
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
                email: teacherData.email,
                role: "staff",
                createdAt: rtdbServerTimestamp(),
              };

              // Create RTDB User Profile
              await rtdbSet(ref(rtdb, `users/${user.uid}`), userData);
              // Create RTDB Role-specific Profile
              await rtdbSet(ref(rtdb, `staffs/${user.uid}`), userData);

              alert("Your account has been automatically activated. Welcome!");
              window.location.href = "/staff-home";
            } else {
              alert(`You are not authorized as a ${role} or ${otherRole} ❌`);
              await auth.signOut();
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


          {role === "staff" && (
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
                <label>Password</label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={onChange}
                  required
                  placeholder="Minimum 6 characters"
                />
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
                <label>Employee ID</label>
                <input name="employeeId" value={form.employeeId} onChange={onChange} required placeholder="Provided by Admin" />
              </div>
              <div className="field">
                <label>New Password</label>
                <input name="password" type="password" value={form.password} onChange={onChange} required minLength="6" />
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
                <input
                  key="login-password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={onChange}
                  required
                />
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
