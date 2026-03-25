/* eslint-disable no-restricted-globals */
import { FlexiblePlanner } from './FlexiblePlanner.js';

self.onmessage = (e) => {
  const { scheduleData } = e.data;

  const getVal = (row, keys) => {
    if (!row) return "";
    const foundKey = Object.keys(row).find(k => 
      keys.some(pk => String(k).toLowerCase().trim() === String(pk).toLowerCase().trim())
    );
    return foundKey ? String(row[foundKey]) : "";
  };

  try {
    if (!scheduleData || !Array.isArray(scheduleData)) {
      throw new Error("Invalid schedule data.");
    }

    // Identify rows that are likely subjects (need at least a name or a code)
    const subjects = scheduleData.filter(i => {
      const name = getVal(i, ['Subject', 'Name', 'Course', 'Title']);
      const code = getVal(i, ['Code', 'SubjectCode', 'CourseCode']);
      return name || code;
    });

    if (subjects.length === 0) {
      throw new Error("Missing required data: No Subjects found in your Excel. Please ensure you have columns like 'Subject' or 'Name'.");
    }

    // The FlexiblePlanner handles faculty extraction from the subject rows
    const planner = new FlexiblePlanner(subjects);
    const results = planner.generate();

    self.postMessage({ type: 'SUCCESS', results });
  } catch (error) {
    self.postMessage({ type: 'ERROR', message: error.message });
  }
};
