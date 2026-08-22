import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LandingPage } from "./marketing/page";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("missing #root");
}

createRoot(root).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>,
);
