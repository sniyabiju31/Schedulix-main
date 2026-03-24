import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { ref, onValue, push, set } from 'firebase/database';
import { rtdb } from './firebase'
import './Planner.css'
import { 
  LayoutDashboard, 
  Calendar, 
  Clipboard, 
  User, 
  Users, 
  Settings, 
  Sparkles, 
  Database, 
  Save, 
  Search, 
  AlertCircle, 
  CheckCircle,
  FileSpreadsheet,
  Trash2,
  Zap
} from 'lucide-react';

function Planner() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isUploading, setIsUploading] = useState(false);
  const [scheduleData, setScheduleData] = useState([]);
  
  // States
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedSem, setSelectedSem] = useState('All');
  
  // Planner States: Used for Multi-Generation
  const [allGenerated, setAllGenerated] = useState(null);
  const [activePlannerGroup, setActivePlannerGroup] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Cloud Published States
  const [publishedLatest, setPublishedLatest] = useState(null);
  const [viewDept, setViewDept] = useState('');
  const [viewSem, setViewSem] = useState('');
  const [viewDiv, setViewDiv] = useState('A');
  const [viewTeacher, setViewTeacher] = useState('');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'schedule', label: 'Schedule', icon: <Database size={20} /> },
    { id: 'planner', label: 'Planner', icon: <Calendar size={20} /> },
    { id: 'teachers', label: 'Faculty', icon: <Users size={20} /> },
    { id: 'students', label: 'Students', icon: <User size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];


  useEffect(() => {
    const schedulesRef = ref(rtdb, 'planner/schedules');
    const unsubscribe = onValue(schedulesRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        const list = Object.entries(data).map(([key, value]) => ({ id: key, ...value }));
        setScheduleData(list);
      } else {
        setScheduleData([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Listen for latest published timetable
    const pubRef = ref(rtdb, 'planner/published_timetables');
    const unsubPub = onValue(pubRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const sortedKeys = Object.keys(data).sort().reverse();
        const latest = data[sortedKeys[0]];
        setPublishedLatest(latest);
        
        // Default views
        if (latest.timetables) {
          const firstKey = Object.keys(latest.timetables)[0];
          if (firstKey) {
            const [d, s, v] = firstKey.split('-');
            if (!viewDept) setViewDept(d);
            if (!viewSem) setViewSem(s);
            if (!viewDiv) setViewDiv(v || 'A');
          }
        }
      }
    });
    return () => unsubPub();
  }, [viewDept, viewSem]);

  const getVal = (item, keys) => {
    if (!item || typeof item !== 'object') return "";
    const foundKey = Object.keys(item).find(k => 
      keys.some(pk => String(k).toLowerCase().trim() === String(pk).toLowerCase().trim())
    );
    return foundKey ? String(item[foundKey]) : "";
  };

  const depts = ["All", ...new Set(scheduleData.map(i => getVal(i, ['Department', 'Dept', 'Branch'])).filter(Boolean))].sort();
  const sems = ["All", ...new Set(scheduleData.map(i => getVal(i, ['Semester', 'Sem', 'SEM', 'SEMESTER', 'Year'])).filter(Boolean))].sort();

  const filtered = scheduleData.filter(i => {
    const d = getVal(i, ['Department', 'Dept', 'Branch']);
    const s = getVal(i, ['Semester', 'Sem', 'SEM', 'SEMESTER', 'Year']);
    return (selectedDept === "All" || d === selectedDept) && (selectedSem === "All" || s === selectedSem);
  });

  const columns = scheduleData.length > 0 
    ? Array.from(new Set(scheduleData.flatMap(item => Object.keys(item)))).filter(k => !['id', 'displayStatus'].includes(k)) 
    : [];

  const handleGenerateAll = () => {
    if (!scheduleData || scheduleData.length === 0) {
      alert("No data to process.");
      return;
    }

    setIsGenerating(true);
    
    // Create a background worker from our script
    const worker = new Worker(new URL('./utils/timetableWorker.js', import.meta.url), {
      type: 'module'
    });

    // Send the data to the worker
    worker.postMessage({ scheduleData });

    // Listen for the result
    worker.onmessage = (e) => {
      const { type, results, message } = e.data;
      
      if (type === 'SUCCESS') {
        setAllGenerated(results);
        const keys = Object.keys(results);
        if (keys.length > 0) setActivePlannerGroup('MASTER');
      } else {
        console.error("Worker Error:", message);
        alert("Generation failed: " + message);
      }
      
      setIsGenerating(false);
      worker.terminate(); // Clean up worker
    };

    worker.onerror = (err) => {
      console.error("Worker Thread Error:", err);
      setIsGenerating(false);
      worker.terminate();
    };
  };

  const handleSaveToCloud = async () => {
    if (!allGenerated) {
      alert("No timetable to save. Please generate first!");
      return;
    }
    
    setIsGenerating(true);
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const publishedRef = ref(rtdb, `planner/published_timetables/${timestamp}`);
      
      // 1. Save the full result to the planner history
      await set(publishedRef, {
        generatedAt: new Date().toLocaleTimeString(),
        timetables: allGenerated
      });

      // 2. Flatten and map to the standard /timetables root for Profiles (Staff/Students)
      // Standard time slots mapping
      const hourSlots = ["9:00-9:50", "9:50-10:40", "10:50-11:40", "11:40-12:30", "1:20-2:10", "2:20-3:10", "3:10-4:00"];
      const updates = {};
      
      Object.keys(allGenerated).forEach(groupKey => {
          // groupKey is like "COMPUTER SCIENCE-SEMESTER 4-A"
          const parts = groupKey.split('-');
          const dept = parts[0];
          const sem = String(parts[1] || "").toUpperCase().replace("SEMESTER", "").trim();
          const div = parts[2] || 'A';
          const data = allGenerated[groupKey];
          
          Object.keys(data.timetable).forEach(day => {
              Object.keys(data.timetable[day]).forEach(periodId => {
                  const p = parseInt(periodId);
                  const slot = data.timetable[day][periodId];
                  if (slot && p >= 1 && p <= 7) {
                      const hourLabel = hourSlots[p - 1];
                      const path = `timetables/${dept}/${sem}/${div}/${day}/${hourLabel}`;
                      updates[path] = {
                          subject: slot.name,
                          teacherName: slot.faculty,
                          teacherEmpId: slot.facultyList && slot.facultyList[0] ? slot.facultyList[0] : "Unassigned",
                          facultyList: slot.facultyList || [],
                          room: slot.room || "TBA",
                          department: dept,
                          semester: sem,
                          division: div,
                          isLab: !!slot.isLab,
                          updatedAt: Date.now()
                      };
                  }
              });
          });
      });

      if (Object.keys(updates).length > 0) {
        // Use the multi-path update for performance
        const { update: rtdbUpdate } = await import('firebase/database');
        await rtdbUpdate(ref(rtdb), updates);
      }

      alert("Timetable Saved & Published Successfully! 💾✅ All staff and student profiles have been updated.");
    } catch (err) {
      console.error("Cloud Save Error:", err);
      alert("Failed to save to cloud: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const workbook = XLSX.read(evt.target.result, { type: 'binary' });
          const allData = [];
          
          workbook.SheetNames.forEach(sheetName => {
            const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
            allData.push(...sheetData);
          });

          if (allData.length === 0) throw new Error("No data found in any sheet.");

          const schedulesRef = ref(rtdb, 'planner/schedules');
          const updates = {};
          allData.forEach((row, index) => {
            const newKey = push(schedulesRef).key;
            updates[newKey] = { 
              ...row, 
              displayStatus: String(row.Status || row.status || 'upcoming').toLowerCase(),
              uploadBatch: new Date().getTime()
            };
          });

          const dbRef = ref(rtdb);
          const finalUpdates = {};
          Object.keys(updates).forEach(k => {
             finalUpdates[`planner/schedules/${k}`] = updates[k];
          });
          
          const { update } = await import('firebase/database');
          await update(dbRef, finalUpdates);
          
          alert(`${allData.length} records successfully imported from ${workbook.SheetNames.length} sheet(s)! 🚀`);
        } catch (e) { 
           console.error("Upload Error:", e);
           alert(`Error: ${e.message}`); 
        } finally { 
           setIsUploading(false); 
           e.target.value = null; 
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const renderPlanner = () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const periods = [1, 2, 3, 4, 5, 6, 7];
    const activeData = allGenerated && activePlannerGroup !== 'MASTER' ? allGenerated[activePlannerGroup] : null;

    // Build the Faculty Array for the 35xN Master Matrix
    let masterFacultyCols = [];
    if (activePlannerGroup === 'MASTER' && allGenerated) {
       const allFacultySet = new Set();
       Object.values(allGenerated).forEach(classData => {
         Object.values(classData.timetable).forEach(daySlots => {
            Object.values(daySlots).forEach(slot => {
               if (slot && slot.facultyList) {
                  slot.facultyList.forEach(f => {
                     if (f && f !== 'Unassigned') allFacultySet.add(f);
                  });
               }
            });
         });
       });
       masterFacultyCols = Array.from(allFacultySet).sort();
    }

    const getFacultyAssignment = (faculty, day, p) => {
        for (const className of Object.keys(allGenerated)) {
           const slot = allGenerated[className].timetable[day]?.[p];
           if (slot && slot.facultyList && slot.facultyList.includes(faculty)) {
               return `${className} (${slot.name})`; 
           }
        }
        return null;
    };

    return (
      <section className="planner-container">
        <div className="planner-controls" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '1.5rem'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center'}}>
            <div>
              <h2 className="section-title" style={{margin: 0, fontSize: '1.5rem'}}>Master Validation Engine</h2>
              <p className="date-msg">Computes interlocking schedules for ALL classes (Guarantees zero faculty overlaps).</p>
            </div>
            <div style={{display: 'flex', gap: '1rem'}}>
              <button 
                className="primary-gradient-btn" 
                onClick={handleGenerateAll}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <span className="spinner"></span>
                    Analyzing Logic...
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    Generate All Departments
                  </>
                )}
              </button>
              
              {allGenerated && (
                <button 
                  className="primary-gradient-btn" 
                  onClick={handleSaveToCloud}
                  style={{background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'}}
                  disabled={isGenerating}
                >
                  <Save size={18} />
                  Save & Publish 
                </button>
              )}
            </div>
          </div>
          
          {allGenerated && (
            <div className="planner-groups-list" style={{display: 'flex', gap: '0.8rem', flexWrap: 'wrap', width: '100%', marginTop: '1rem'}}>
              <button 
                onClick={() => setActivePlannerGroup('MASTER')}
                className="filter-select" 
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px', 
                  background: activePlannerGroup === 'MASTER' ? 'var(--primary)' : 'var(--glass-bg)',
                  color: 'white',
                  border: activePlannerGroup === 'MASTER' ? 'none' : '1px solid var(--glass-border)',
                  fontWeight: '600',
                  borderRadius: '12px',
                  transition: 'all 0.2s'
                }}
              >
                <Sparkles size={16} color="#fbbf24" /> MASTER FACULTY GRID
              </button>
              
              {Object.keys(allGenerated).map(k => (
                <button 
                  key={k} 
                  onClick={() => setActivePlannerGroup(k)}
                  className="filter-select" 
                  style={{ 
                    padding: '10px 20px', 
                    background: activePlannerGroup === k ? 'var(--primary)' : 'var(--glass-bg)',
                    color: 'white',
                    border: activePlannerGroup === k ? 'none' : '1px solid var(--glass-border)',
                    fontWeight: '600',
                    borderRadius: '12px',
                    transition: 'all 0.2s'
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
        </div>

        {activePlannerGroup === 'MASTER' && allGenerated ? (
          <div className="master-view-container" style={{marginTop: '2rem'}}>
             <div style={{background: 'var(--bg-card)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border-color)', overflowX: 'auto', maxHeight: '600px', overflowY: 'auto'}}>
               <h3 style={{margin: '0 0 1.5rem 0', color: 'white', display: 'flex', alignItems: 'center', gap: '10px'}}>
                 <Sparkles size={20} color="#fbbf24" /> Global Faculty Allocation Matrix (35 Hours)
               </h3>
               
               <table className="data-table" style={{whiteSpace: 'nowrap', width: 'max-content', fontSize: '0.85rem'}}>
                 <thead style={{position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)'}}>
                   <tr>
                     <th style={{position: 'sticky', left: 0, zIndex: 12, background: 'var(--bg-card)', borderRight: '1px solid var(--border-color)', minWidth: '150px'}}>
                       FACULTY NAME
                     </th>
                     {days.map(day => {
                       let abbr = '';
                       switch(day) {
                         case 'Monday': abbr = 'M'; break;
                         case 'Tuesday': abbr = 'T'; break;
                         case 'Wednesday': abbr = 'W'; break;
                         case 'Thursday': abbr = 'TH'; break;
                         case 'Friday': abbr = 'F'; break;
                         default: abbr = day.substring(0,1);
                       }

                       return periods.map(p => (
                         <th key={`header-${day}-${p}`} style={{textAlign: 'center', borderLeft: '2px solid rgba(255,255,255,0.05)', minWidth: '80px', color: 'var(--text-muted)'}}>
                           {abbr}{p}
                         </th>
                       ));
                     })}
                   </tr>
                 </thead>
                 <tbody>
                   {masterFacultyCols.map(faculty => (
                     <tr key={faculty}>
                       <td style={{fontWeight: '700', position: 'sticky', left: 0, zIndex: 5, background: 'var(--bg-card)', borderRight: '1px solid var(--border-color)', color: 'var(--primary-color)'}}>
                         {faculty}
                       </td>
                       {days.map(day => (
                         periods.map(p => {
                           const assignment = getFacultyAssignment(faculty, day, p);
                           return (
                             <td key={`cell-${faculty}-${day}-${p}`} style={{
                               textAlign: 'center',
                               background: assignment ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                               color: assignment ? 'var(--text-primary)' : '#64748b',
                               fontWeight: assignment ? '600' : '400',
                               borderLeft: '1px dashed rgba(255,255,255,0.05)'
                             }}>
                               {assignment || '-'}
                             </td>
                           )
                         })
                       ))}
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        ) : activeData ? (
          <div className="generated-content">
            {activeData.conflicts && activeData.conflicts.length > 0 && (
              <div style={{padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', border: '1px solid #ef4444', color: '#ef4444', marginBottom: '1.5rem'}}>
                <h4 style={{margin: '0 0 0.5rem 0'}}>Generation Warnings</h4>
                <ul style={{margin: 0, paddingLeft: '1.5rem', fontSize: '0.85rem'}}>
                  {activeData.conflicts.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
              
            <div className="timetable-grid">
              <div className="period-header">DAY</div>
              {periods.map(p => <div key={p} className="period-header">P{p}</div>)}
              
              {days.map(day => (
                <React.Fragment key={day}>
                  <div className="day-label">{day.substring(0, 3)}</div>
                  {periods.map(p => {
                    const item = activeData.timetable[day]?.[p];
                    return (
                      <div key={`${day}-${p}`} className={`slot ${item?.isLab ? 'slot-lab' : ''} ${!item ? 'slot-empty' : ''}`}>
                        {item ? (
                          <>
                            <div className="slot-subject">{item.name}</div>
                            <div className="slot-faculty">{item.faculty}</div>
                          </>
                        ) : '-'}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            <div className="stats-grid" style={{marginTop: '2rem'}}>
              <div className="stat-card">
                <span className="stat-label">Lab Blocks in {activePlannerGroup}</span>
                <div style={{marginTop: '10px'}}>
                  {activeData.summary.length === 0 ? <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>No 3-hour labs.</span> : activeData.summary.map((l, i) => (
                    <div key={i} style={{fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: '5px'}}>
                      🔥 {l.subject} ({l.day} {l.block})
                    </div>
                  ))}
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-label">Subject Allocation Targets</span>
                <div style={{marginTop: '10px', maxHeight: '150px', overflowY: 'auto'}}>
                  {activeData.allocation.map((a, i) => (
                    <div key={i} style={{fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}}>
                      <span>{a.name}</span>
                      <span style={{color: a.allocated ? '#22c55e' : '#ef4444'}}>{a.allocated ? '✅ Complete' : `❌ ${a.remaining} Left`}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    );
  };

  return (
    <div className="app-main-layout">
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon">T</div>
          <span className="logo-text">TimeSchedule</span>
        </div>
        <nav className="nav-links">
          {navItems.map((item) => (
             <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
              <span className="item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <div className="search-container">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--text-muted)'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" placeholder="Search records..." className="search-input" />
          </div>
          <div className="user-profile">
            <div className="avatar">A</div>
            <div className="user-info">
              <span style={{fontWeight: '600', fontSize: '0.9rem'}}>Anjali</span>
              <span style={{color: 'var(--text-muted)', fontSize: '0.75rem'}}>Administrator</span>
            </div>
          </div>
        </header>

        <div className="content-scroll">
          {activeTab === 'dashboard' && (
            <section className="dashboard-container">
              <div className="header-section">
                <h1 className="welcome-msg">Dashboard 👋</h1>
                <p className="date-msg">Cloud Sync & Status Overview (Admin)</p>
              </div>
              <div className="filter-bar">
                <div className="filter-group">
                  <label className="filter-label">Department</label>
                  <select className="filter-select" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                    {depts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label className="filter-label">Semester</label>
                  <select className="filter-select" value={selectedSem} onChange={(e) => setSelectedSem(e.target.value)}>
                    {sems.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="stats-grid">
                <div className="stat-card"><span className="stat-label">Matches</span><span className="stat-value">{filtered.length}</span></div>
                <div className="stat-card"><span className="stat-label">Total Cloud</span><span className="stat-value">{scheduleData.length}</span></div>
              </div>
              <div className="schedule-section">
                <h2 className="section-title">Schedule List</h2>
                <div className="table-container">
                  <table className="data-table">
                    <thead><tr>{columns.map(c => <th key={String(c)}>{String(c).toUpperCase()}</th>)}</tr></thead>
                    <tbody>{filtered.map((item) => <tr key={item.id}>{columns.map(c => <td key={`${item.id}-${c}`}>{String(item[c] || 'N/A')}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'schedule' && (
            <section className="schedule-container">
              <div className="page-header">
                <h1 className="page-title">Manage Data</h1>
                <button className="danger-btn" onClick={() => { if(window.confirm("Delete ALL?")) set(ref(rtdb, 'planner/schedules'), null); }}>Clear All</button>
              </div>
              <label className="upload-card">
                <div className="upload-text">
                  <p className="upload-title">{isUploading ? 'Syncing...' : 'Upload Excel Sheet'}</p>
                </div>
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden-input" onChange={handleFileUpload} disabled={isUploading} />
              </label>
            </section>
          )}

          {activeTab === 'planner' && renderPlanner()}

          {activeTab === 'students' && (
            <section className="portal-container" style={{padding: '2rem'}}>
              <div className="portal-header" style={{textAlign: 'center', marginBottom: '3rem'}}>
                 <h1 className="portal-title" style={{fontSize: '2.5rem', fontWeight: '800', background: 'linear-gradient(to right, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>Student Portal</h1>
                 <p style={{color: 'var(--text-muted)'}}>Browse the latest strictly-validated academic schedule.</p>
              </div>

              {!publishedLatest ? (
                 <div className="upload-card" style={{padding: '4rem', textAlign: 'center'}}>
                    <p>No timetable has been published yet. 🕒</p>
                 </div>
              ) : (
                <>
                  <div className="filter-bar" style={{justifyContent: 'center', gap: '2rem', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '24px', backdropFilter: 'blur(10px)', border: '1px solid var(--border-color)', marginBottom: '3rem'}}>
                    <div className="filter-group">
                      <label className="filter-label">Department</label>
                      <select className="filter-select" value={viewDept} onChange={e => setViewDept(e.target.value)}>
                        {Array.from(new Set(Object.keys(publishedLatest.timetables).map(k => k.split('-')[0]))).map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="filter-group">
                      <label className="filter-label">Semester</label>
                      <select className="filter-select" value={viewSem} onChange={e => setViewSem(e.target.value)}>
                        {Array.from(new Set(Object.keys(publishedLatest.timetables).filter(k => k.startsWith(viewDept)).map(k => {
                           const s = k.split('-')[1];
                           return s.toUpperCase().replace("SEMESTER", "").trim();
                        }))).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="filter-group">
                      <label className="filter-label">Division</label>
                      <select className="filter-select" value={viewDiv} onChange={e => setViewDiv(e.target.value)}>
                        {Array.from(new Set(Object.keys(publishedLatest.timetables).filter(k => k.startsWith(`${viewDept}-${viewSem}`)).map(k => k.split('-')[2] || 'A'))).map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const normSem = String(viewSem).toUpperCase().replace("SEMESTER", "").trim();
                    const matchKey = Object.keys(publishedLatest.timetables).find(k => {
                        const pk = k.split('-');
                        const pDept = pk[0];
                        const pSem = String(pk[1] || "").toUpperCase().replace("SEMESTER", "").trim();
                        const pDiv = pk[2] || 'A';
                        return pDept === viewDept && pSem === normSem && pDiv === viewDiv;
                    });

                    const timetableObj = matchKey ? publishedLatest.timetables[matchKey] : null;

                    return timetableObj ? (
                      <div className="glass-timetable" style={{background: 'var(--bg-card)', padding: '2rem', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255,255,255,0.1)'}}>
                        <div className="timetable-grid">
                          <div className="period-header">DAY</div>
                          {[1,2,3,4,5,6,7].map(p => <div key={p} className="period-header">P{p}</div>)}
                          
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                            <React.Fragment key={day}>
                              <div className="day-label" style={{background: 'linear-gradient(to bottom, #6366f1, #4f46e5)', color: 'white', fontWeight: '800', borderRadius: '12px'}}>{day.substring(0, 3)}</div>
                              {[1,2,3,4,5,6,7].map(p => {
                                const item = timetableObj.timetable[day]?.[p];
                                return (
                                  <div key={`${day}-${p}`} className={`slot ${item?.isLab ? 'slot-lab' : ''} ${!item ? 'slot-empty' : ''}`} style={{height: '90px', borderRadius: '16px', margin: '4px'}}>
                                    {item ? (
                                      <>
                                        <div className="slot-subject" style={{fontSize: '0.8rem'}}>{item.name}</div>
                                        <div className="slot-faculty" style={{fontSize: '0.65rem', opacity: 0.7}}>{item.faculty}</div>
                                      </>
                                    ) : '-'}
                                  </div>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="upload-card">No schedule found for this selection. ({viewDept} {normSem} {viewDiv})</div>
                    );
                  })()}
                </>
              )}
            </section>
          )}

          {activeTab === 'teachers' && (
            <section className="portal-container" style={{padding: '2rem'}}>
                <div className="portal-header" style={{textAlign: 'center', marginBottom: '3rem'}}>
                 <h1 className="portal-title" style={{fontSize: '2.5rem', fontWeight: '800', color: 'var(--primary-color)'}}>Faculty Portal</h1>
                 <p style={{color: 'var(--text-muted)'}}>Personalized workload visualization and conflict-free schedules.</p>
              </div>

              {!publishedLatest ? (
                 <div className="upload-card">No data published.</div>
              ) : (
                 <>
                   <div style={{maxWidth: '500px', margin: '0 auto 3rem auto', background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)'}}>
                      <label className="filter-label" style={{textAlign: 'center', display: 'block', marginBottom: '1rem'}}>Select Your Name</label>
                      <select className="filter-select" style={{width: '100%', borderRadius: '12px'}} value={viewTeacher} onChange={e => setViewTeacher(e.target.value)}>
                        <option value="">Choose Faculty member...</option>
                        {Array.from(new Set(Object.values(publishedLatest.timetables).flatMap(t => 
                           Object.values(t.timetable).flatMap(d => 
                             Object.values(d).flatMap(s => s && s.facultyList ? s.facultyList : [])
                           )
                        ))).sort().filter(f => f && f !== 'Unassigned').map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                   </div>

                   {viewTeacher && (
                      <div className="glass-timetable" style={{overflowX: 'auto'}}>
                         <table className="data-table" style={{minWidth: '800px'}}>
                            <thead>
                               <tr>
                                  <th>Period</th>
                                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => <th key={d}>{d}</th>)}
                               </tr>
                            </thead>
                            <tbody>
                               {[1,2,3,4,5,6,7].map(p => (
                                  <tr key={p}>
                                     <td style={{fontWeight: '900', color: 'var(--primary-color)'}}>P{p}</td>
                                     {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                                        let assignment = "";
                                        Object.entries(publishedLatest.timetables).forEach(([cls, data]) => {
                                           const slot = data.timetable[day]?.[p];
                                           if (slot && slot.facultyList && slot.facultyList.includes(viewTeacher)) {
                                              assignment = `${cls}\n(${slot.name})`;
                                           }
                                        });

                                        return (
                                          <td key={day} style={{
                                             textAlign: 'center', 
                                             background: assignment ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                             whiteSpace: 'pre-line',
                                             fontSize: '0.8rem',
                                             fontWeight: assignment ? '700' : '400',
                                             color: assignment ? 'var(--text-primary)' : 'var(--text-muted)'
                                          }}>
                                             {assignment || '-'}
                                          </td>
                                        )
                                     })}
                                  </tr>
                               ))}
                            </tbody>
                         </table>
                      </div>
                   )}
                 </>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

export default Planner;
