import React, { useState } from "react";
import "./auth.css";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("admin");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  function onChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const { email, password, name } = form;

    try {
      if (mode === "signup") {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCredential.user;
        const userRole = role;
        await setDoc(doc(db, userRole, user.uid), {
          name,
          email,
        });
        alert(`Signed up as ${role.toUpperCase()}`);
        window.location.href = "/home";
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        const user = auth.currentUser;
        if (user) {
          const userRole = role;
          const docRef = doc(db, userRole, user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            alert(`${role} login successful ✅`);
            window.location.href =
              userRole === "admin" ? "/admin-home" : "/staff-home";
          } else {
            alert(`You are not authorized as a ${role} ❌`);
          }
        }
      }
    } catch (error) {
      alert(error.message);
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
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => setMode("signup")}
          >
            Signup
          </button>
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
            <div className="field">
              <label>Name</label>
              <input name="name" value={form.name} onChange={onChange} />
            </div>
          )}

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

          <button type="submit" className="submit">
            {mode === "login" ? `Login as ${role}` : `Sign up as ${role}`}
          </button>
        </form>
      </div>
    </div>
  );
}
