import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Stylesheet order is the cascade order: base → material tokens → controls → targeted hardening.
// Feature stylesheets (launcher, spotlight, settings) load with their components.
import "../../src/styles/global.css";
import "../../src/styles/material.css";
import "../../src/styles/controls.css";
import "../../src/styles/design-hardening.css";
import { OnboardingGate } from "../../src/features/onboarding/OnboardingGate";

const root = document.getElementById("root");
if (!root) throw new Error("Asterfold root element is missing");
createRoot(root).render(<StrictMode><OnboardingGate /></StrictMode>);
