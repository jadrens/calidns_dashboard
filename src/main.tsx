import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/jetbrains-mono/400.css";
import "./style.css";
import DnsManagerApp from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><DnsManagerApp basePath={import.meta.env.BASE_URL} enable_theme_switch_button enable_i18n_switch_button /></React.StrictMode>,
);
