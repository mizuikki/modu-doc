import ReactDOM from "react-dom/client";
import "./styles.css";
import "./i18n/i18n";
import { App } from "./app/App";
import { AppProvider } from "./app/AppProvider";
import { DialogProvider } from "./components/dialog/DialogProvider";
import { ToastProvider } from "./components/toast/ToastProvider";
import { logDebugPerf } from "./lib/debugPerf";
import { ensureE2ePerfCollector } from "./lib/e2ePerf";

ensureE2ePerfCollector();
void logDebugPerf("main module evaluated");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <ToastProvider>
    <DialogProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </DialogProvider>
  </ToastProvider>,
);

void logDebugPerf("react root render scheduled");
