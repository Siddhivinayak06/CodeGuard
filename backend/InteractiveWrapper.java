// InteractiveWrapper.java
// Compile: javac InteractiveWrapper.java
// Run: java -cp /app InteractiveWrapper
//
// Protocol:
// - The wrapper reads lines from stdin.
// - Lines are appended to the current submission buffer until a line equals "__RUN_CODE__".
// - On "__RUN_CODE__", wrapper compiles & runs the code and streams outputs back to stdout/stderr.
// - After finishing a compile/run, wrapper prints markers so caller can detect completion.

import java.io.*;
import java.nio.file.*;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class InteractiveWrapper {
    // sentinel that client uses to tell wrapper to compile & run
    private static final String RUN_SENTINEL = "__RUN_CODE__";
    private static final long RUN_TIMEOUT_MS = Long.parseLong(System.getenv().getOrDefault("WRAPPER_RUN_TIMEOUT_MS", "5000"));

    public static void main(String[] args) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder submission = new StringBuilder();
        String line;

        // Read loop: accumulate submission until RUN_SENTINEL, then process.
        while (true) {
            line = in.readLine();
            if (line == null) {
                // EOF -> exit
                System.err.println("Interactive wrapper: EOF on stdin, exiting.");
                break;
            }

            if (RUN_SENTINEL.equals(line.trim())) {
                // Process the accumulated submission
                processSubmission(submission.toString(), System.out, System.err);
                // reset submission buffer after processing
                submission.setLength(0);
                // keep listening for more submissions
                continue;
            }

            // accumulate line (preserve newline)
            submission.append(line).append(System.lineSeparator());
        }
    }

    private static void processSubmission(String code, PrintStream out, PrintStream err) {
        String sessionId = UUID.randomUUID().toString();
        Path workDir = null;
        try {
            workDir = Files.createTempDirectory("interactive_" + sessionId + "_");
            // ensure directory exists
            File wd = workDir.toFile();
            wd.setReadable(true, false);
            wd.setWritable(true, false);

            // Save raw user code temporarily
            Path tempFile = workDir.resolve("TempUserCode.java");
            Files.write(tempFile, code.getBytes());

            // Detect package (if any)
            String pkgLine = detectPackage(code); // e.g. "package com.example;"
            String className = detectFirstClassName(code); // e.g. "Solution" or "Main" or null
            boolean hasMain = detectsMainMethod(code);

            // Determine destination filename
            Path destFile;
            if (className != null && !className.isEmpty()) {
                destFile = workDir.resolve(className + ".java");
            } else {
                destFile = workDir.resolve("UserCode.java");
            }

            // Move (or copy) temp file to destination name
            Files.move(tempFile, destFile, StandardCopyOption.REPLACE_EXISTING);

            // If user has main and public class isn't Main, create wrapper Main.java that calls it.
            if (hasMain && className != null && !className.equals("Main")) {
                Path wrapperFile = workDir.resolve("Main.java");
                StringBuilder wrapper = new StringBuilder();
                if (pkgLine != null && !pkgLine.isEmpty()) {
                    wrapper.append(pkgLine).append(System.lineSeparator());
                }
                wrapper.append("public class Main {").append(System.lineSeparator());
                wrapper.append("    public static void main(String[] args) {").append(System.lineSeparator());
                wrapper.append("        try {").append(System.lineSeparator());
                wrapper.append("            ").append(className).append(".main(args);").append(System.lineSeparator());
                wrapper.append("        } catch (Throwable t) {").append(System.lineSeparator());
                wrapper.append("            t.printStackTrace();").append(System.lineSeparator());
                wrapper.append("            System.exit(1);").append(System.lineSeparator());
                wrapper.append("        }").append(System.lineSeparator());
                wrapper.append("    }").append(System.lineSeparator());
                wrapper.append("}").append(System.lineSeparator());
                Files.write(wrapperFile, wrapper.toString().getBytes());
            }

            // Compile: javac *.java
            ProcessBuilder javacPb = new ProcessBuilder("javac", "*.java");
            // We need to run javac from the workDir and NOT rely on wildcard expansion by shell,
            // so use 'sh -c "javac *.java"' to allow wildcard expansion.
            ProcessBuilder compilePb = new ProcessBuilder("sh", "-c", "javac *.java");
            compilePb.directory(workDir.toFile());
            Process compileProc = compilePb.start();

            // capture compile stdout/stderr
            String compileErr = drainStream(compileProc.getErrorStream(), 200);
            String compileOut = drainStream(compileProc.getInputStream(), 200);

            compileProc.waitFor(3, TimeUnit.SECONDS);

            if (compileErr != null && !compileErr.isEmpty()) {
                // Send a clear marker + compile errors to stderr so caller knows it's a compile failure.
                err.println("❌COMPILE_ERROR");
                err.println(compileErr);
                err.println("❌END_COMPILE_ERROR");
                return;
            }

            // If compilation succeeded, run `java -cp . Main`
            // If Main.java doesn't exist but user's file contains main and class name == Main, that's fine.
            // We'll run 'java -cp . Main' and allow JVM to run.
            ProcessBuilder runPb = new ProcessBuilder("java", "-cp", ".", "Main");
            runPb.directory(workDir.toFile());
            Process runProc = runPb.start();

            // Start threads to forward output/error streams
            ExecutorService ex = Executors.newFixedThreadPool(2);
            Future<String> stdoutFuture = ex.submit(() -> streamToString(runProc.getInputStream(), out));
            Future<String> stderrFuture = ex.submit(() -> streamToString(runProc.getErrorStream(), err));

            boolean finished = runProc.waitFor(RUN_TIMEOUT_MS, TimeUnit.MILLISECONDS);
            if (!finished) {
                // Timeout: destroy process
                runProc.destroyForcibly();
                err.println("❌RUNTIME_TIMEOUT");
                err.println("Program exceeded time limit (" + RUN_TIMEOUT_MS + " ms)");
                err.println("❌END_RUNTIME_TIMEOUT");
            } else {
                int rc = runProc.exitValue();
               
            }

            // shutdown executor
            ex.shutdownNow();

        } catch (Exception e) {
            e.printStackTrace(err);
        } finally {
            // cleanup the working directory
            if (workDir != null) {
                try {
                    deleteRecursively(workDir);
                } catch (IOException ioe) {
                    System.err.println("Warning: failed to delete temp workDir: " + ioe.getMessage());
                }
            }
        }
    }

    private static String detectPackage(String code) {
        BufferedReader br = new BufferedReader(new StringReader(code));
        String line;
        try {
            while ((line = br.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.startsWith("package ")) {
                    // return whole line with trailing semicolon removed if any
                    return trimmed.endsWith(";") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
                }
            }
        } catch (IOException e) {
            // ignore
        }
        return null;
    }

    private static String detectFirstClassName(String code) {
        // matches "public class Name" or "class Name"
        Pattern p = Pattern.compile("(?m)^[\\s]*(?:public\\s+)?class\\s+([A-Za-z_][A-Za-z0-9_]*)");
        Matcher m = p.matcher(code);
        if (m.find()) {
            return m.group(1);
        }
        return null;
    }

    private static boolean detectsMainMethod(String code) {
        // crude detection of 'public static void main('
        return code.contains("public static void main(") || code.contains("public static void main (");
    }

    // read up to 'limitMillis' ms to warm-drain small streams; returns string
    private static String drainStream(InputStream is, long limitMillis) throws IOException {
        StringBuilder sb = new StringBuilder();
        BufferedReader br = new BufferedReader(new InputStreamReader(is));
        long deadline = System.currentTimeMillis() + limitMillis;
        while (System.currentTimeMillis() < deadline && br.ready()) {
            String l = br.readLine();
            if (l == null) break;
            sb.append(l).append(System.lineSeparator());
        }
        // try a final non-blocking read for what's available
        while (br.ready()) {
            String l = br.readLine();
            if (l == null) break;
            sb.append(l).append(System.lineSeparator());
        }
        return sb.toString();
    }

    private static String streamToString(InputStream is, PrintStream forwardTo) {
        try (BufferedReader br = new BufferedReader(new InputStreamReader(is))) {
            String s;
            while ((s = br.readLine()) != null) {
                forwardTo.println(s);
            }
        } catch (IOException e) {
            // ignore
        }
        return "";
    }

    private static void deleteRecursively(Path path) throws IOException {
        if (!Files.exists(path)) return;
        Files.walk(path)
             .sorted((a, b) -> b.compareTo(a)) // reverse; delete children first
             .forEach(p -> {
                 try {
                     Files.deleteIfExists(p);
                 } catch (IOException e) {
                     // ignore
                 }
             });
    }
}
