// InteractiveWrapper.java - Simple version
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

public class InteractiveWrapper {
    private static final String RUN_SENTINEL = "__RUN_CODE__";
    private static final int TIMEOUT_SECONDS = 60; // Wall-clock timeout
    private static final String CPU_LIMIT = "3"; // CPU seconds limit

    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        List<String> codeBuffer = new ArrayList<>();
        String line;

        while ((line = reader.readLine()) != null) {
            if (RUN_SENTINEL.equals(line.trim())) {
                // Execute buffered code
                executeCode(String.join("\n", codeBuffer));
                codeBuffer.clear();
                System.out.println("\n...Code execution finished.\n");
                System.out.flush();
            } else {
                codeBuffer.add(line);
            }
        }
    }

    private static void executeCode(String code) {
        Path tempDir = null;
        try {
            // Create temp directory
            tempDir = Files.createTempDirectory("java_exec_");
            
            // Detect class name
            String className = extractClassName(code);
            if (className == null) {
                className = "Main";
                code = "public class Main {\n" + code + "\n}";
            }
            
            // Write code to file
            Path javaFile = tempDir.resolve(className + ".java");
            Files.write(javaFile, code.getBytes());
            
            // Compile
            ProcessBuilder compilePb = new ProcessBuilder("javac", className + ".java");
            compilePb.directory(tempDir.toFile());
            compilePb.redirectErrorStream(true);
            Process compileProc = compilePb.start();
            
            String compileOutput = readStream(compileProc.getInputStream());
            compileProc.waitFor(3, TimeUnit.SECONDS);
            
            if (compileProc.exitValue() != 0) {
                System.err.println("❌ Compilation Error:");
                System.err.println(compileOutput);
                return;
            }
            
            // Run with CPU time limit (catches infinite loops, not I/O wait time)
            ProcessBuilder runPb = new ProcessBuilder(
                "sh", "-c", 
                "ulimit -t " + CPU_LIMIT + " && java -cp . " + className
            );
            runPb.directory(tempDir.toFile());
            runPb.inheritIO(); // Allow interactive input/output
            
            Process runProc = runPb.start();
            
            boolean finished = runProc.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                runProc.destroyForcibly();
                System.err.println("\n⏱️ Code execution timed out!");
            }
            
        } catch (Exception e) {
            System.err.println("❌ Error: " + e.getMessage());
        } finally {
            // Cleanup
            if (tempDir != null) {
                deleteDirectory(tempDir.toFile());
            }
        }
    }

    private static String extractClassName(String code) {
        // Simple regex to find "public class ClassName"
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(
            "public\\s+class\\s+([A-Za-z_][A-Za-z0-9_]*)"
        );
        java.util.regex.Matcher matcher = pattern.matcher(code);
        return matcher.find() ? matcher.group(1) : null;
    }

    private static String readStream(InputStream is) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(is));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            sb.append(line).append("\n");
        }
        return sb.toString();
    }

    private static void deleteDirectory(File dir) {
        if (dir.exists()) {
            File[] files = dir.listFiles();
            if (files != null) {
                for (File file : files) {
                    if (file.isDirectory()) {
                        deleteDirectory(file);
                    } else {
                        file.delete();
                    }
                }
            }
            dir.delete();
        }
    }
}