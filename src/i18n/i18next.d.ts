import "i18next";

import type en from "./locales/en.json";

declare module "i18next" {
  interface CustomTypeOptions {
    enableSelector: false;
    parseInterpolation: false;
    defaultNS: "translation";
    resources: {
      translation: typeof en;
    };
  }
}
