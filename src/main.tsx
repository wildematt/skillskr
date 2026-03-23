import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/layout.css";
import "./styles/sidebar.css";
import "./styles/skill-list.css";
import "./styles/detail-pane.css";
import "./styles/overlay.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
