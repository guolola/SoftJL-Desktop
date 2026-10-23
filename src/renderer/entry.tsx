// Opens the modeling workbench directly at the local projects list.
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./src/app/App.js";
import { DesktopFrame } from "./desktop-frame.js";
import "./src/app/styles/index.css";
import "./desktop-shell.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DesktopFrame><App /></DesktopFrame>
  </React.StrictMode>,
);
