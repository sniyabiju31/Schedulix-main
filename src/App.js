import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Auth from "./Auth";
import AdminHomePage from "./AdminHome";
import StaffHomePage from "./home";
import StudentHomePage from "./StudentHome";
import ParentHomePage from "./ParentHome";
import Planner from "./Planner";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="App">
        {/* App Title */}
        <header className="app-header">
          <h1 className="app-title">Schedulix</h1>
          <p className="app-tagline">Smart Scheduling Made Simple</p>
        </header>

        {/* Auth Page */}
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/admin-home" element={<AdminHomePage />} />
          <Route path="/staff-home" element={<StaffHomePage />} />
          <Route path="/student-home" element={<StudentHomePage />} />
          <Route path="/parent-home" element={<ParentHomePage />} />
          <Route path="/planner" element={<Planner />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
