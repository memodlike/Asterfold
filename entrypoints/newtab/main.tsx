import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceApp } from "../../src/app/WorkspaceApp";
import "../../src/styles/global.css";

const root = document.getElementById("root");
if (!root) throw new Error("Asterfold root element is missing");
createRoot(root).render(<StrictMode><WorkspaceApp /></StrictMode>);
