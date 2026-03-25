import { ref, set, push } from "firebase/database";
import { rtdb } from "../firebase";

export const seedPlannerData = async () => {
  const plannerRef = ref(rtdb, "planner");
  
  const initialData = {
    tasks: {
      "initial_task_1": {
        text: "Initialize Academic Planner",
        status: "Completed",
        priority: "High",
        createdAt: Date.now()
      },
      "initial_task_2": {
        text: "Review Semester 6 Timetables",
        status: "Pending",
        priority: "High",
        createdAt: Date.now()
      },
      "initial_task_3": {
        text: "Staff Meeting for Lab Allocation",
        status: "Pending",
        priority: "Medium",
        createdAt: Date.now()
      }
    },
    events: {
      "initial_event_1": {
        title: "Semester 6 Commencement",
        date: "2024-04-01",
        time: "09:00 AM",
        location: "Main Auditorium"
      },
      "initial_event_2": {
        title: "Internal Assessment 1",
        date: "2024-04-15",
        time: "10:30 AM",
        location: "Respective Classrooms"
      }
    }
  };

  try {
    await set(plannerRef, initialData);
    console.log("Planner database initialized successfully.");
    return true;
  } catch (error) {
    console.error("Error seeding planner data:", error);
    return false;
  }
};
