import { expect } from "@wdio/globals";

describe("ModuDoc app", () => {
  it("smokes the root window", async () => {
    await expect($("header strong")).toHaveText("ModuDoc");
    await expect($("main")).toBeDisplayed();
  });
});
