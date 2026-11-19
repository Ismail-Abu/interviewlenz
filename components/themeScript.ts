// Shared by the root layout (server) and components/theme.ts (client).
// Kept free of "use client" so the layout can inline THEME_SCRIPT as a string.

export const THEME_KEY = "interviewlenz:theme";
export const ACTIVE_KEY = "interviewlenz:theme-active";

// Runs in <head> before first paint: a signed-in user who chose dark never sees a white flash.
export const THEME_SCRIPT = `(function(){try{if(localStorage.getItem("${ACTIVE_KEY}")==="1"&&localStorage.getItem("${THEME_KEY}")==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}})()`;
