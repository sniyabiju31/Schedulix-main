import React, { useState } from "react";
import "./auth.css";

// DEMO ONLY — hardcoded credentials
const DEFAULT_ADMIN = {
  email: "admin@example.com",
  password: "admin123",
};

const DEFAULT_STAFF = {
  email: "staff@example.com",
  password: "staff123",
};

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

  function handleSubmit(e) {
    e.preventDefault();

    // LOGIN MODE
    if (mode === "login") {
      // Admin login
      if (
        role === "admin" &&
        form.email === DEFAULT_ADMIN.email &&
        form.password === DEFAULT_ADMIN.password
      ) {
        alert("Admin login successful ✅");
        window.location.href = "/admin-home";
        return;
      }

      // Staff login
      if (
        role === "staff" &&
        form.email === DEFAULT_STAFF.email &&
        form.password === DEFAULT_STAFF.password
      ) {
        alert("Staff login successful ✅");
        window.location.href = "/staff-home";
        return;
      }

      alert("Invalid email or password ❌");
      return;
    }

    // SIGNUP MODE (demo only)
    alert(`Signed up as ${role.toUpperCase()}`);
    window.location.href = "/home";
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
              <input
                name="name"
                value={form.name}
                onChange={onChange}
              />
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

        {mode === "login" && (
          <div className="demo-hint">
            <h4>Demo Credentials</h4>
            <p><strong>Admin:</strong> admin@example.com / admin123</p>
            <p><strong>Staff:</strong> staff@example.com / staff123</p>
          </div>
        )}
      </div>
    </div>
  );
}
