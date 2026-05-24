import { browser } from "@wdio/globals";

type TauriCore = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
};

export async function waitForTauriBridge(timeoutMs = 20000) {
  await browser.waitUntil(
    async () =>
      (await browser.execute(() => {
        const tauri = (window as Window & { __TAURI__?: { core: TauriCore } }).__TAURI__;
        return Boolean(tauri?.core);
      })) as boolean,
    { timeout: timeoutMs, interval: 200, timeoutMsg: "Tauri bridge unavailable" },
  );
}

export async function tauriInvoke<TResult>(
  command: string,
  args?: Record<string, unknown>,
): Promise<TResult> {
  await waitForTauriBridge();
  const result = (await browser.executeAsync(
    (cmd, commandArgs, done) => {
      const tauri = (window as Window & { __TAURI__?: { core: TauriCore } }).__TAURI__;
      if (!tauri) {
        done({ __invokeError: "Tauri bridge unavailable" });
        return;
      }
      tauri.core
        .invoke(cmd as string, commandArgs as Record<string, unknown>)
        .then((value) => done(value))
        .catch((error) => done({ __invokeError: String(error) }));
    },
    command,
    args ?? {},
  )) as TResult | { __invokeError?: string };

  if (typeof result === "object" && result && "__invokeError" in result) {
    throw new Error(result.__invokeError || "Tauri invocation failed");
  }

  return result as TResult;
}
