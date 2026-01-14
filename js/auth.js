// Firebase Authentication Module
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA_Eduv9UdPH5rOLm1rfCw3JpmQrNBhXNs",
  authDomain: "test-app-c7bab.firebaseapp.com",
  projectId: "test-app-c7bab",
  storageBucket: "test-app-c7bab.firebasestorage.app",
  messagingSenderId: "838732142820",
  appId: "1:838732142820:web:729f37ef7927d8c602f4f1",
  measurementId: "G-EE69HWP928"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Current user state
let currentUser = null;

// Detect current page
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
const isLoginPage = currentPage === 'index.html';
const isSignupPage = currentPage === 'signup.html';
const isMainPage = currentPage === 'create.html' || currentPage === '';

// DOM Elements (check if they exist on current page)
const loadingScreen = document.getElementById("loading-screen");
const timetablePage = document.getElementById("timetable-page");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const errorMessage = document.getElementById("error-message");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

// Show error message
function showError(message) {
  if (errorMessage) {
    errorMessage.textContent = message;
    errorMessage.classList.add("show");
    setTimeout(() => {
      errorMessage.classList.remove("show");
    }, 4000);
  }
}

// Auth State Listener
onAuthStateChanged(auth, (user) => {
  // Hide loading screen on main page
  if (loadingScreen) {
    loadingScreen.style.display = "none";
  }

  if (user) {
    currentUser = user;
    
    // If on login/signup page, redirect to main page
    if (isLoginPage || isSignupPage) {
      window.location.href = "create.html";
      return;
    }
    
    // Show timetable page if on main page
    if (timetablePage) {
      timetablePage.style.display = "block";
    }
    
    // Dispatch custom event for script.js to handle
    window.dispatchEvent(new CustomEvent("userLoggedIn", { detail: user }));
  } else {
    currentUser = null;
    
    // Redirect to login if on main page and not authenticated
    if (isMainPage && timetablePage) {
      window.location.href = "index.html";
    }
  }
});

// Handle Login Form Submission
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const loginBtn = document.getElementById("login-btn");
    
    if (!email || !password) {
      showError("Please fill in all fields");
      return;
    }
    
    try {
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<span>Signing in...</span>';
      
      await signInWithEmailAndPassword(auth, email, password);
      
      // Redirect will happen via onAuthStateChanged
      
    } catch (error) {
      console.error("Login error:", error);
      let errorMsg = "Login failed. Please try again.";
      
      switch (error.code) {
        case "auth/user-not-found":
          errorMsg = "No account found with this email";
          break;
        case "auth/wrong-password":
          errorMsg = "Incorrect password";
          break;
        case "auth/invalid-email":
          errorMsg = "Invalid email address";
          break;
        case "auth/invalid-credential":
          errorMsg = "Invalid email or password";
          break;
        case "auth/too-many-requests":
          errorMsg = "Too many attempts. Please try again later";
          break;
      }
      
      showError(errorMsg);
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<span>Sign In</span>';
    }
  });
}

// Handle Signup Form Submission
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const signupBtn = document.getElementById("signup-btn");
    
    if (!email || !password) {
      showError("Please fill in all fields");
      return;
    }
    
    if (password.length < 6) {
      showError("Password must be at least 6 characters");
      return;
    }
    
    try {
      signupBtn.disabled = true;
      signupBtn.innerHTML = '<span>Creating account...</span>';
      
      await createUserWithEmailAndPassword(auth, email, password);
      
      // Redirect will happen via onAuthStateChanged
      
    } catch (error) {
      console.error("Signup error:", error);
      let errorMsg = "Signup failed. Please try again.";
      
      switch (error.code) {
        case "auth/email-already-in-use":
          errorMsg = "An account with this email already exists";
          break;
        case "auth/invalid-email":
          errorMsg = "Invalid email address";
          break;
        case "auth/weak-password":
          errorMsg = "Password is too weak";
          break;
      }
      
      showError(errorMsg);
    } finally {
      signupBtn.disabled = false;
      signupBtn.innerHTML = '<span>Create Account</span>';
    }
  });
}

// Logout function (exported for use in other modules)
export function logout() {
  return signOut(auth);
}

// Get current user
export function getCurrentUser() {
  return currentUser;
}

// Export auth instance for use in script.js
export { app, auth };

