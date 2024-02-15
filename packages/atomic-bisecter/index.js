import { execSync, spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

execSync("npm ci --no-package-lock", { stdio: "ignore" });
execSync("npm run build -w=@coveo/atomic", {
  stdio: "inherit",
});

const dev = spawn(npm, ["run", "dev", "-w=@coveo/atomic"], {
  stdio: "pipe",
});

// Pipe outputs
// dev.stderr.pipe(process.stderr);
// dev.stdout.pipe(process.stdout);

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
execSync('kill -9 $(lsof -t -i:3333)', {stdio: 'ignore'})

// Exit with 0 if the test passed, 1 otherwise
process.exit(success ? 0 : 1);
