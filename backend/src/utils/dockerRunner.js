const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

module.exports = function runPythonCode(code) {
  return new Promise((resolve, reject) => {
    const tmpDir = path.join(__dirname, "../../tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const codeFile = path.join(tmpDir, "code.py");
    fs.writeFileSync(codeFile, code);

    const cmd = `docker run --rm --network none -m 128m --cpus="0.5" \
      -v ${tmpDir}:/app python:3 python /app/code.py`;

    exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error && error.killed) {
        return resolve({ output: "", error: "Execution timed out." });
      }
      resolve({ output: stdout, error: stderr });
    });
  });
};
