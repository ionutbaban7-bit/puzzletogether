/** Shared optional Chromium executable support for constrained CI/sandboxes. */
export function chromiumLaunchOptions() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const args = (process.env.PLAYWRIGHT_CHROMIUM_ARGS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    ...(executablePath ? { executablePath } : {}),
    ...(args.length ? { args } : {}),
  };
}
