import { execSync, spawn } from "child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const uiKitDirPath = process.env.UI_KIT_DIR_PATH;
const bisecterDirPath = dirname(fileURLToPath(import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const waitForTextInStream = (stream, text) => {
  let buffer = "";
  return new Promise((resolve) => {
    stream.on("data", (chunk) => {
      buffer += chunk;
      if (buffer.includes(text)) {
        resolve();
      }
    });
  });
};

execSync("npm ci --no-package-lock", { stdio: "inherit", cwd: uiKitDirPath });
execSync("npm run build -w=@coveo/atomic", {
  stdio: "inherit",
  cwd: uiKitDirPath,
});
const dev = spawn(npm, ["run", "dev", "-w=@coveo/atomic"], {
  stdio: "pipe",
});

// Pipe outputs
dev.stderr.pipe(process.stderr);
dev.stdout.pipe(process.stdout);

// Wait for the server to start
await Promise.race([
  waitForTextInStream(dev.stdout, "http://localhost:3333"),
  waitForTextInStream(dev.stderr, "http://localhost:3333"),
]);

// Run the test
let success = true;
try {
  execSync("npx playwright test ", { cwd: bisecterDirPath, stdio: "inherit" });
} catch (e) {
  success = false;
}
// Ensure all's clean before continuing bisecting
execSync("git checkout -f");

// Forcefully kill everything, we got what we wanted (the test result).
process.exit(success ? 0 : 1);
