import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OnboardingGate } from "../../src/features/onboarding/OnboardingGate";
import "../../src/styles/global.css";
import "../../src/styles/opaque-ui.css";

const root = document.getElementById("root");
if (!root) throw new Error("Asterfold root element is missing");
createRoot(root).render(<StrictMode><OnboardingGate /></StrictMode>);
