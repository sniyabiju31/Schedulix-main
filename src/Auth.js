import React, { useState } from "react";
import "./auth.css";
import { auth, db, rtdb } from "./firebase";
// Using Realtime Database for signup/login instead of Firebase Auth account creation
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { ref, set as rtdbSet, get as rtdbGet, serverTimestamp as rtdbServerTimestamp, push, query as rtdbQuery, orderByChild, equalTo } from "firebase/database";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, fetchSignInMethodsForEmail, onAuthStateChanged } from "firebase/auth";

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
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const { email, password, name, username } = form;

    try {
      if (mode === "activate") {
        // FIRST TIME TEACHER LOGIN
        const { email, employeeId, password } = form;

        // 1. Verify existence in teachers collection
        const q = query(collection(db, "teachers"), where("email", "==", email), where("employeeId", "==", employeeId));
        const snap = await getDocs(q);

        if (snap.empty) {
          alert("No teacher found with this Email and Employee ID. Please contact Admin.");
          return;
        }

        const teacherData = snap.docs[0].data();

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
          const userRole = role;
          const docRef = doc(db, userRole, user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            alert(`${role} login successful ✅`);
            window.location.href = userRole === "admin" ? "/admin-home" : "/staff-home";
          } else {
            // If Firestore doesn't have the role document, check Realtime Database
            const rtdbUserSnap = await rtdbGet(ref(rtdb, `users/${user.uid}`));
            const roleNodeSnap = await rtdbGet(ref(rtdb, `${userRole}s/${user.uid}`));

            if (rtdbUserSnap.exists()) {
              const rtdbUser = rtdbUserSnap.val();
              if (rtdbUser.role === userRole) {
                alert(`${role} login successful via RTDB ✅`);
                window.location.href = userRole === "admin" ? "/admin-home" : "/staff-home";
              } else {
                alert(`You are not authorized as a ${role} ❌`);
              }
            } else if (roleNodeSnap.exists()) {
              alert(`${role} login successful via RTDB (${userRole} node) ✅`);
              window.location.href = userRole === "admin" ? "/admin-home" : "/staff-home";
            } else {
              alert(`You are not authorized as a ${role} ❌`);
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
                <input name="name" value={form.name} onChange={onChange} />
              </div>

              <div className="field">
                <label>Username</label>
                <input name="username" value={form.username} onChange={onChange} />
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

          {mode !== "activate" && (
            <div className="field">
              <label>Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                required
              />
            </div>
          )}

          {mode !== "activate" && (
            <div className="field">
              <label>Password</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={onChange}
                required
              />
            </div>
          )}

          <button type="submit" className="submit">
            {mode === "login" ? `Login as ${role}` : mode === "activate" ? "Activate Account" : `Sign up as ${role}`}
          </button>
        </form>
      </div>
    </div>
  );
}
