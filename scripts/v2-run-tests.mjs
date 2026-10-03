// Fresh instance per suite: no production traffic, no cross-suite rate-limit pollution.
import net from "node:net";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const suites = process.argv.slice(2);
if (!suites.length) throw new Error("Pass one or more test script paths");
for (const suite of suites) {
  const data = mkdtempSync(join(tmpdir(), "pt-v2-test-"));
  const port = await new Promise((resolve, reject) => {
    const reservation = net.createServer();
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", () => {
      const port = reservation.address().port;
      reservation.close(() => resolve(port));
    });
  });
  const base = `http://127.0.0.1:${port}`;
  let logs = "";
  const server = spawn(process.execPath, ["src/server.js"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: data,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (x) => {
    logs += x;
  });
  server.stderr.on("data", (x) => {
    logs += x;
  });
  let failed = false;
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      if (server.exitCode != null) throw new Error(logs);
      try {
        if ((await fetch(base + "/api/health")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!ready) throw new Error("Server did not start");
    console.log("\nSUITE", suite);
    const child = spawn(process.execPath, [suite], {
      env: { ...process.env, BASE: base },
      stdio: "inherit",
    });
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("Suite exceeded 120 seconds"));
      }, 120000);
      child.on("error", reject);
      child.on("exit", (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
    });
    if (result !== 0) throw new Error(`Suite failed: ${suite} (${result})`);
  } catch (e) {
    failed = true;
    console.error(e.message);
    console.error(logs.slice(-4000));
  } finally {
    await new Promise((resolve) => {
      if (server.exitCode != null) return resolve();
      const timer = setTimeout(() => server.kill("SIGKILL"), 2000);
      server.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      server.kill("SIGTERM");
    });
    rmSync(data, { recursive: true, force: true });
  }
  if (failed) process.exit(1);
}
