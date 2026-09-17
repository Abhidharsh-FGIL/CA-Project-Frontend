// Runtime configuration — loaded before the app starts.
// Edit dist/config.js directly on the deployed server to change the API URL WITHOUT rebuilding.
// This file (public/config.js) is the default that gets copied into every build.
//
// BASE_URL must NOT have a trailing slash.
// Nginx strips the deployment prefix, so:
//   BASE_URL = "https://futuregenautomation.com/assessment_portal/api"
//   path     = "/api/v1/user/auth/login"
//   result   = "https://futuregenautomation.com/assessment_portal/api/api/v1/user/auth/login"
//   nginx strips "/assessment_portal/api" → FastAPI receives "/api/v1/user/auth/login" ✓
//
// For local development change this to: http://localhost:8000
window.__APP_CONFIG__ = {
  API_BASE_URL: "https://futuregenautomation.com/school_assessment/api",
};
