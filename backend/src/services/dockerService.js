const { spawn } = require("child_process");
const pty = require("@lydell/node-pty");
const config = require("../config");

const killIfExists = (proc) => {
  try {
    if (proc && typeof proc.kill === "function") {
      proc.kill();
    }
  } catch (e) {
    // ignore
  }
};

const removeContainer = (name) => {
  try {
    spawn("docker", ["rm", "-f", name]);
  } catch (e) {
    // ignore
  }
};

const launchContainer = (lang, containerName) => {
  console.log(`Starting container for language: ${lang}`);

  let runArgs = [];
  if (lang === "python") {
    runArgs = [
      "run", "--rm", "--name", containerName, "-d",
      "--network", "none", "-m", config.docker.memory, "--cpus=" + config.docker.cpus,
      "--pids-limit", config.docker.pidsLimit, "--read-only",
      "--tmpfs", `/tmp:exec,rw,size=${config.docker.memory}`,
      "codeguard-python", "tail", "-f", "/dev/null"
    ];
  } else if (lang === "c") {
    runArgs = [
      "run", "--rm", "--name", containerName, "-d",
      "--network", "none", "-m", config.docker.memory, "--cpus=" + config.docker.cpus,
      "--pids-limit", config.docker.pidsLimit,
      "--tmpfs", "/app/workspace:exec,rw,size=64m,uid=1000,gid=1000,mode=1777",
      "codeguard-c", "tail", "-f", "/dev/null"
    ];
  } else if (lang === "java") {
    runArgs = [
      "run", "--rm", "--name", containerName, "-d",
      "--network", "none", "-m", config.docker.javaMemory, "--cpus=" + config.docker.cpus,
      "--pids-limit", config.docker.javaPidsLimit,
      "--tmpfs", `/tmp:exec,rw,size=${config.docker.javaMemory}`,
      "codeguard-java", "tail", "-f", "/dev/null"
    ];
  }

  if (runArgs.length > 0) {
    try {
      const proc = spawn("docker", runArgs);
      proc.on("error", (err) => {
        console.error(`Failed to spawn docker for ${lang}:`, err);
      });
    } catch (e) {
      console.error(`Exception spawning docker for ${lang}:`, e);
    }
  }
};

const execPython = (containerName, onData, onExit) => {
  const pythonProcess = spawn("docker", [
    "exec", "-i", containerName,
    "python", "-u", "/app/interactive_wrapper.py"
  ], { stdio: ["pipe", "pipe", "pipe"] });

  pythonProcess.stdout.on("data", onData);
  pythonProcess.stderr.on("data", onData);

  if (onExit) {
    pythonProcess.on("exit", onExit);
  }

  return pythonProcess;
};

const execJava = (containerName, onData, onExit) => {
  const javaProcess = spawn("docker", [
    "exec", "-i", "-u", "runner", containerName,
    "java", "-jar", "/app/interactive_wrapper.jar"
  ], { stdio: ["pipe", "pipe", "pipe"] });

  javaProcess.stdout.on("data", onData);
  javaProcess.stderr.on("data", onData);

  if (onExit) {
    javaProcess.on("exit", onExit);
  }

  return javaProcess;
};

const execC = (containerName, onData, onExit) => {
  console.log("Starting C wrapper process inside container with node-pty");

  const cProcess = pty.spawn("docker", [
    "exec", "-it", "-u", "runner",
    containerName, "/app/interactive_wrapper.out"
  ], {
    name: "xterm-color",
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    env: process.env,
  });

  cProcess.onData(onData);

  if (onExit) {
    cProcess.onExit(onExit);
  }

  return cProcess;
};

module.exports = {
  killIfExists,
  removeContainer,
  launchContainer,
  execPython,
  execJava,
  execC
};
