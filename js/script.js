import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { get, getDatabase, onValue, push, ref, remove, set, update } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { app,logout } from "./auth.js";

// Initialize Realtime Database
const db = getDatabase(app);
const auth = getAuth(app);

// DOM elements
const subjectInput = document.getElementById("subject");
const timeInput = document.getElementById("time");
const goalInput = document.getElementById("goal");
const addBtn = document.getElementById("add-btn");
const entriesContainer = document.getElementById("entries");
const downloadBtn = document.getElementById("download-pdf");
const startTimeInput = document.getElementById("start-time");
const durationInput = document.getElementById("duration");
const generateSlotBtn = document.getElementById("generate-slot");
const dayButtons = document.querySelectorAll(".day-btn");

// Modal elements
const confirmModal = document.getElementById("confirm-modal");
const modalIcon = document.getElementById("modal-icon");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const modalCancel = document.getElementById("modal-cancel");
const modalConfirm = document.getElementById("modal-confirm");

let currentDay = "Monday";
let currentUser = null;
let editTaskId = null;
let unsubscribe = null;
let pendingAction = null; // Store the pending action callback

// ===== MODAL FUNCTIONS =====
function showModal(options) {
  return new Promise((resolve) => {
    const { type, title, message, confirmText = "Confirm", cancelText = "Cancel" } = options;
    
    // Set modal content
    if (modalIcon) {
      modalIcon.textContent = type === "delete" ? "🗑️" : type === "edit" ? "✏️" : "⚠️";
      modalIcon.className = `modal-icon ${type}`;
    }
    if (modalTitle) modalTitle.textContent = title;
    if (modalMessage) modalMessage.textContent = message;
    if (modalConfirm) {
      modalConfirm.textContent = confirmText;
      modalConfirm.className = `modal-btn modal-btn-confirm ${type}`;
    }
    if (modalCancel) modalCancel.textContent = cancelText;
    
    // Show modal
    if (confirmModal) {
      confirmModal.classList.add("show");
      
      // Force reflow for animation
      setTimeout(() => {
        confirmModal.style.opacity = "1";
      }, 10);
    }
    
    // Handle confirm
    const handleConfirm = () => {
      hideModal();
      resolve(true);
    };
    
    // Handle cancel
    const handleCancel = () => {
      hideModal();
      resolve(false);
    };
    
    // Handle click outside modal
    const handleOutsideClick = (e) => {
      if (e.target === confirmModal) {
        hideModal();
        resolve(false);
      }
    };
    
    // Handle escape key
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        hideModal();
        resolve(false);
      }
    };
    
    // Add event listeners
    if (modalConfirm) {
      modalConfirm.onclick = handleConfirm;
    }
    if (modalCancel) {
      modalCancel.onclick = handleCancel;
    }
    if (confirmModal) {
      confirmModal.onclick = handleOutsideClick;
    }
    document.addEventListener("keydown", handleEscape, { once: true });
  });
}

function hideModal() {
  if (confirmModal) {
    confirmModal.classList.remove("show");
    confirmModal.style.opacity = "0";
  }
}

// ===== AUTH LISTENER =====
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    setupRealtimeListener();
  } else {
    currentUser = null;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (entriesContainer) {
      entriesContainer.innerHTML = "";
    }
  }
});

// ===== REALTIME LISTENER =====
function setupRealtimeListener() {
  if (!currentUser) return;
  
  if (unsubscribe) {
    unsubscribe();
  }
  
  const userTimetableRef = ref(db, `timetables/${currentUser.uid}`);
  
  unsubscribe = onValue(userTimetableRef, (snapshot) => {
    renderEntries(snapshot);
  }, (error) => {
    console.error("Realtime listener error:", error);
    if (entriesContainer) {
      entriesContainer.innerHTML = '<p style="text-align: center; color: #d44;">Error loading tasks. Please refresh.</p>';
    }
  });
}

// ===== RENDER ENTRIES =====
function renderEntries(snapshot) {
  if (!entriesContainer) return;
  
  entriesContainer.innerHTML = "";
  
  if (!snapshot.exists()) {
    entriesContainer.innerHTML = '<p style="text-align: center; color: #888;">No tasks for this day. Add one above!</p>';
    return;
  }
  
  const data = snapshot.val();
  const tasks = [];
  
  Object.keys(data).forEach(key => {
    if (data[key].day === currentDay) {
      tasks.push({ id: key, ...data[key] });
    }
  });

  tasks.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  
  if (tasks.length === 0) {
    entriesContainer.innerHTML = '<p style="text-align: center; color: #888;">No tasks for this day. Add one above!</p>';
    return;
  }
  
  tasks.forEach(entry => {
    const card = document.createElement("div");
    card.className = "entry-card";
    card.innerHTML = `
      <div class="entry-flex">
        <label class="checkbox-label">
          <input type="checkbox" class="task-check" ${entry.completed ? "checked" : ""}>
          <div class="entry-content ${entry.completed ? "completed" : ""}">
            <h3>${entry.subject}</h3>
            <p><strong>Time:</strong> ${entry.time}</p>
            <p><strong>Goal:</strong> ${entry.goal}</p>
          </div>
        </label>
        <div class="btn-group">
          <button class="edit-btn" title="Edit task">✎</button>
          <button class="delete-btn" title="Delete task">❌</button>
        </div>
      </div>
    `;
    
    // Checkbox toggle
    const checkbox = card.querySelector(".task-check");
    if (checkbox) {
      checkbox.addEventListener("change", async (e) => {
        try {
          const taskRef = ref(db, `timetables/${currentUser.uid}/${entry.id}`);
          await update(taskRef, { completed: e.target.checked });
        } catch (error) {
          console.error("Error updating task:", error);
          alert("Failed to update task.");
        }
      });
    }
    
    // Delete button with modal confirmation
    const deleteBtn = card.querySelector(".delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        const confirmed = await showModal({
          type: "delete",
          title: "Delete Task",
          message: `Are you sure you want to delete "${entry.subject}"? This action cannot be undone.`,
          confirmText: "Delete",
          cancelText: "Cancel"
        });
        
        if (confirmed) {
          try {
            const taskRef = ref(db, `timetables/${currentUser.uid}/${entry.id}`);
            await remove(taskRef);
          } catch (error) {
            console.error("Error deleting task:", error);
            alert("Failed to delete task.");
          }
        }
      });
    }
    
    // Edit button with modal confirmation
    const editBtn = card.querySelector(".edit-btn");
    if (editBtn) {
      editBtn.addEventListener("click", async () => {
        const confirmed = await showModal({
          type: "edit",
          title: "Edit Task",
          message: `Do you want to edit "${entry.subject}"? The current form values will be replaced.`,
          confirmText: "Edit",
          cancelText: "Cancel"
        });
        
        if (confirmed) {
          if (subjectInput) subjectInput.value = entry.subject;
          if (timeInput) timeInput.value = entry.time;
          if (goalInput) goalInput.value = entry.goal;
          editTaskId = entry.id;
          
          if (addBtn) {
            addBtn.textContent = "✏️ Update Task";
            addBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    }
    
    entriesContainer.appendChild(card);
  });
}

// ===== DAY SWITCH =====
if (dayButtons.length > 0) {
  dayButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      dayButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentDay = btn.dataset.day;
      
      if (currentUser) {
        const userTimetableRef = ref(db, `timetables/${currentUser.uid}`);
        get(userTimetableRef).then(snapshot => {
          renderEntries(snapshot);
        });
      }
    });
  });
}

// ===== TIME SLOT GENERATOR =====
if (generateSlotBtn && startTimeInput && durationInput && timeInput) {
  generateSlotBtn.addEventListener("click", () => {
    const startTime = startTimeInput.value;
    const duration = parseInt(durationInput.value);
    if (!startTime || isNaN(duration)) { 
      alert("Select start time & duration"); 
      return; 
    }

    const [h, m] = startTime.split(":").map(Number);
    const start = new Date(); 
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + duration * 60000);
    const format = d => d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
    timeInput.value = `${format(start)} - ${format(end)}`;
  });
}

// ===== ADD / EDIT TASK =====
if (addBtn && subjectInput && timeInput && goalInput) {
  addBtn.addEventListener("click", async () => {
    if (!currentUser) {
      alert("Please login first");
      return;
    }
    
    const subject = subjectInput.value.trim();
    const time = timeInput.value.trim();
    const goal = goalInput.value.trim();
    
    if (!subject || !time || !goal) {
      alert("Fill all fields");
      return;
    }

    try {
      if (editTaskId) {
        // Show confirmation for update
        const confirmed = await showModal({
          type: "edit",
          title: "Update Task",
          message: `Save changes to "${subject}"?`,
          confirmText: "Save",
          cancelText: "Cancel"
        });
        
        if (!confirmed) return;
        
        const taskRef = ref(db, `timetables/${currentUser.uid}/${editTaskId}`);
        await update(taskRef, {
          subject,
          time,
          goal,
          day: currentDay,
          updatedAt: Date.now()
        });
        editTaskId = null;
        addBtn.textContent = "➕ Add to Timetable";
      } else {
        // Add new task (no confirmation needed)
        const userTimetableRef = ref(db, `timetables/${currentUser.uid}`);
        const newTaskRef = push(userTimetableRef);
        await set(newTaskRef, {
          subject,
          time,
          goal,
          day: currentDay,
          completed: false,
          createdAt: Date.now()
        });
      }

      // Clear inputs
      subjectInput.value = "";
      timeInput.value = "";
      goalInput.value = "";
      if (startTimeInput) startTimeInput.value = "";
      
    } catch (error) {
      console.error("Error adding/updating task:", error);
      alert("Failed to save task. Please try again.");
    }
  });
}

// ===== CANCEL EDIT BUTTON =====
// Add cancel button functionality when in edit mode
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && editTaskId) {
    // Cancel edit mode
    editTaskId = null;
    if (subjectInput) subjectInput.value = "";
    if (timeInput) timeInput.value = "";
    if (goalInput) goalInput.value = "";
    if (startTimeInput) startTimeInput.value = "";
    if (addBtn) addBtn.textContent = "➕ Add to Timetable";
  }
});

// ===== DOWNLOAD PDF =====
if (downloadBtn) {
  downloadBtn.addEventListener("click", async () => {
    if (!currentUser) {
      alert("Please login first");
      return;
    }
    
    try {
      const userTimetableRef = ref(db, `timetables/${currentUser.uid}`);
      const snapshot = await get(userTimetableRef);
      
      const grouped = {Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []};
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.keys(data).forEach(key => {
          const entry = data[key];
          if (grouped[entry.day]) {
            grouped[entry.day].push(entry);
          }
        });
      }

      let content = `<div style="padding:1rem; font-family:'Segoe UI',sans-serif;">
        <h1 style="text-align:center; color:#7b4ca0;">Weekly Study Timetable</h1>`;

      for (const day of Object.keys(grouped)) {
        const dayEntries = grouped[day];
        content += `<h2 style="color:#5f3d90; margin-top:1rem;">${day}</h2>`;
        if (dayEntries.length === 0) {
          content += "<p>No entries.</p>";
        } else {
          dayEntries.forEach(e => {
            content += `<div style="background:#f8f1fa; padding:10px; margin:8px 0; border-left:4px solid #a074c4; border-radius:8px;">
              <strong>Subject:</strong> ${e.subject}<br/>
              <strong>Time:</strong> ${e.time}<br/>
              <strong>Goal:</strong> ${e.goal}<br/>
            </div>`;
          });
        }
      }
      content += "</div>";

      if (window.html2pdf) {
        window.html2pdf().from(content).set({
          margin: 0.5,
          filename: 'Weekly_Timetable.pdf', 
          image: {type: 'jpeg', quality: 0.98}, 
          html2canvas: {scale: 2}, 
          jsPDF: {unit: 'in', format: 'a4', orientation: 'portrait'}
        }).save();
      } else {
        alert("PDF library not loaded. Please refresh and try again.");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  });
}

// ===== LOGOUT =====
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    const confirmed = await showModal({
      type: "logout",
      title: "Logout",
      message: "Are you sure you want to logout?",
      confirmText: "Yes",
      cancelText: "Cancel"
    });

    if (confirmed) {
      try {
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        await logout();
        currentUser = null;
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
  });
}
