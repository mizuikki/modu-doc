import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import "./i18n/i18n";
import { App } from "./app/App";
import { AppProvider } from "./app/AppProvider";
import { DialogProvider } from "./components/dialog/DialogProvider";
import { ToastProvider } from "./components/toast/ToastProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <DialogProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </DialogProvider>
    </ToastProvider>
  </React.StrictMode>,
);
