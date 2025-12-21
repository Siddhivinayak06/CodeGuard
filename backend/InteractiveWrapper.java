import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

public class InteractiveWrapper {
    private static final String FILE_START_SENTINEL = "__FILE_START__";
    private static final String RUN_SENTINEL = "__RUN_CODE__";
    private static final int TIMEOUT_SECONDS = 60;
    private static final String CPU_LIMIT = "15";

    // ANSI Colors
    private static final String RED = "\033[91m";
    private static final String GREEN = "\033[92m";
    private static final String YELLOW = "\033[93m";
    private static final String CYAN = "\033[96m";
    private static final String RESET = "\033[0m";

    public static void main(String[] args) throws Exception {
        // Use /app/workspace for all files in this session
        Path workspace = Paths.get("/app/workspace");
        if (!Files.exists(workspace)) {
            Files.createDirectories(workspace);
        }
        Path sessionDir = Files.createTempDirectory(workspace, "java_session_");

        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        List<String> currentFileBuffer = new ArrayList<>();
        String currentFileName = "Main.java";
        String line;

        try {
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();

                if (trimmed.startsWith(FILE_START_SENTINEL)) {
                    // Save previous file if code existed
                    if (!currentFileBuffer.isEmpty()) {
                        saveFile(sessionDir, currentFileName, currentFileBuffer);
                        currentFileBuffer.clear();
                    }
                    currentFileName = trimmed.substring(FILE_START_SENTINEL.length()).trim();
                    if (currentFileName.isEmpty())
                        currentFileName = "Main.java";
                    if (!currentFileName.endsWith(".java"))
                        currentFileName += ".java";
                    continue;
                }

                if (RUN_SENTINEL.equals(trimmed)) {
                    // Save the last file before running
                    saveFile(sessionDir, currentFileName, currentFileBuffer);
                    currentFileBuffer.clear();

                    // Execute
                    executeSession(sessionDir, currentFileName.replace(".java", ""));

                    System.out.println("\n" + CYAN + "--- Execution Finished ---" + RESET + "\n");
                    System.out.flush();
                    // Reset to default name for next batch
                    currentFileName = "Main.java";
                } else {
                    currentFileBuffer.add(line);
                }
            }
        } finally {
            deleteDirectory(sessionDir.toFile());
        }
    }

    private static void saveFile(Path dir, String fileName, List<String> buffer) throws IOException {
        if (buffer.isEmpty())
            return;
        Path filePath = dir.resolve(fileName);
        Files.write(filePath, String.join("\n", buffer).getBytes());
    }

    private static void executeSession(Path dir, String mainClassName) {
        try {
            // Compile with -g:none for speed (skip debug info)
            ProcessBuilder compilePb = new ProcessBuilder("sh", "-c", "javac -g:none *.java");
            compilePb.directory(dir.toFile());
            compilePb.redirectErrorStream(true);
            Process compileProc = compilePb.start();

            String compileOutput = readStream(compileProc.getInputStream());
            boolean compiled = compileProc.waitFor(15, TimeUnit.SECONDS);

            if (!compiled || compileProc.exitValue() != 0) {
                System.err.println(RED + "❌ Compilation Error:" + RESET);
                System.err.println(compileOutput);
                return;
            }

            System.out.println(GREEN + "✅ Compilation successful" + RESET);

            // Run with performance-tuned JVM flags
            ProcessBuilder runPb = new ProcessBuilder(
                    "sh", "-c",
                    "ulimit -t " + CPU_LIMIT + " && java -XX:TieredStopAtLevel=1 -cp . " + mainClassName);
            runPb.directory(dir.toFile());
            runPb.inheritIO();

            Process runProc = runPb.start();

            boolean finished = runProc.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                runProc.destroyForcibly();
                System.err.println("\n" + YELLOW + "⏱️ Code execution timed out!" + RESET);
            }

        } catch (Exception e) {
            System.err.println(RED + "❌ Error: " + e.getMessage() + RESET);
        }
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