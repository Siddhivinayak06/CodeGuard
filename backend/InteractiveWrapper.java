import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class InteractiveWrapper {
    private static final String FILE_START_SENTINEL = "__FILE_START__";
    private static final String RUN_SENTINEL = "__RUN_CODE__";
    private static final int TIMEOUT_SECONDS = 60;
    private static final String CPU_LIMIT = "15";
    private static final Pattern PACKAGE_PATTERN = Pattern.compile("^\\s*package\\s+([a-zA-Z0-9_.]+)\\s*;", Pattern.MULTILINE);
    private static final Pattern CLASS_PATTERN = Pattern.compile("(?m)^(?:public\\s+)?class\\s+([A-Za-z_][A-Za-z0-9_]*)");
    private static final Pattern MAIN_METHOD_PATTERN = Pattern.compile("\\bpublic\\s+static\\s+void\\s+main\\s*\\(");
    private static final Pattern APPLET_CLASS_PATTERN = Pattern.compile(
            "(?:public\\s+)?class\\s+([A-Za-z_][A-Za-z0-9_]*)\\s+extends\\s+(?:java\\.applet\\.Applet|javax\\.swing\\.JApplet|Applet|JApplet)\\b");

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
                        saveFileSafely(sessionDir, currentFileName, currentFileBuffer);
                        currentFileBuffer.clear();
                    }
                    currentFileName = normalizeJavaFileName(trimmed.substring(FILE_START_SENTINEL.length()).trim());
                    continue;
                }

                if (RUN_SENTINEL.equals(trimmed)) {
                    // Save the last file before running
                    saveFileSafely(sessionDir, currentFileName, currentFileBuffer);
                    currentFileBuffer.clear();

                    // Execute
                    executeSession(sessionDir, currentFileName);

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

    private static String normalizeJavaFileName(String fileName) {
        String normalized = (fileName == null ? "" : fileName.trim()).replace('\\', '/');
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        if (normalized.isEmpty()) {
            normalized = "Main.java";
        }
        if (!normalized.endsWith(".java")) {
            normalized += ".java";
        }
        return normalized;
    }

    private static Path resolveSafePath(Path baseDir, String relativePath) throws IOException {
        Path resolved = baseDir.resolve(relativePath).normalize();
        if (!resolved.startsWith(baseDir)) {
            throw new IOException("Invalid path: " + relativePath);
        }
        return resolved;
    }

    private static void saveFileSafely(Path dir, String fileName, List<String> buffer) {
        try {
            saveFile(dir, fileName, buffer);
        } catch (IOException e) {
            System.err.println(RED + "❌ Error saving " + fileName + ": " + e.getMessage() + RESET);
        }
    }

    private static void saveFile(Path dir, String fileName, List<String> buffer) throws IOException {
        Path filePath = resolveSafePath(dir, normalizeJavaFileName(fileName));
        Path parent = filePath.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        Files.write(filePath, String.join("\n", buffer).getBytes(StandardCharsets.UTF_8));
    }

    private static List<String> listJavaFiles(Path dir) throws IOException {
        try (Stream<Path> stream = Files.walk(dir)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(path -> path.toString().endsWith(".java"))
                    .map(path -> dir.relativize(path).toString().replace(File.separatorChar, '/'))
                    .sorted()
                    .collect(Collectors.toList());
        }
    }

    private static String extractPackageName(String source) {
        Matcher packageMatcher = PACKAGE_PATTERN.matcher(source);
        return packageMatcher.find() ? packageMatcher.group(1) : null;
    }

    private static String extractMainClassName(String source) {
        Matcher mainMatcher = MAIN_METHOD_PATTERN.matcher(source);
        if (!mainMatcher.find()) {
            return null;
        }

        int mainIndex = mainMatcher.start();
        String beforeMain = source.substring(0, mainIndex);
        Matcher classMatcher = CLASS_PATTERN.matcher(beforeMain);

        String lastClassBeforeMain = null;
        while (classMatcher.find()) {
            lastClassBeforeMain = classMatcher.group(1);
        }

        if (lastClassBeforeMain != null) {
            return lastClassBeforeMain;
        }

        Matcher anyClassMatcher = CLASS_PATTERN.matcher(source);
        if (anyClassMatcher.find()) {
            return anyClassMatcher.group(1);
        }

        return null;
    }

    private static String extractAppletClassName(String source) {
        Matcher appletMatcher = APPLET_CLASS_PATTERN.matcher(source);
        return appletMatcher.find() ? appletMatcher.group(1) : null;
    }

    private static String resolveMainClassFromFile(Path dir, String relativePath) {
        try {
            Path javaFile = resolveSafePath(dir, normalizeJavaFileName(relativePath));
            if (!Files.exists(javaFile)) {
                return null;
            }

            String source = Files.readString(javaFile, StandardCharsets.UTF_8);
            String className = extractMainClassName(source);
            if (className == null) {
                return null;
            }

            String packageName = extractPackageName(source);
            return packageName == null ? className : packageName + "." + className;
        } catch (IOException e) {
            return null;
        }
    }

    private static String resolveAppletClassFromFile(Path dir, String relativePath) {
        try {
            Path javaFile = resolveSafePath(dir, normalizeJavaFileName(relativePath));
            if (!Files.exists(javaFile)) {
                return null;
            }

            String source = Files.readString(javaFile, StandardCharsets.UTF_8);
            String className = extractAppletClassName(source);
            if (className == null) {
                return null;
            }

            String packageName = extractPackageName(source);
            return packageName == null ? className : packageName + "." + className;
        } catch (IOException e) {
            return null;
        }
    }

    private static String buildAppletLauncherCode(String packageName, String appletFqcn) {
        String packageDecl = packageName != null ? "package " + packageName + ";\n" : "";
        return packageDecl + "public class __RunnerLauncher {\n"
                + "    public static void main(String[] args) {\n"
                + "        System.setProperty(\"java.awt.headless\", \"true\");\n"
                + "        try {\n"
                + "            Object instance = Class.forName(\"" + appletFqcn
                + "\").getDeclaredConstructor().newInstance();\n"
                + "            if (instance instanceof java.applet.Applet) {\n"
                + "                java.applet.Applet applet = (java.applet.Applet) instance;\n"
                + "                applet.init();\n"
                + "                applet.start();\n"
                + "                java.awt.image.BufferedImage canvas = new java.awt.image.BufferedImage(\n"
                + "                    1,\n"
                + "                    1,\n"
                + "                    java.awt.image.BufferedImage.TYPE_INT_ARGB\n"
                + "                );\n"
                + "                java.awt.Graphics2D g = canvas.createGraphics();\n"
                + "                applet.paint(g);\n"
                + "                g.dispose();\n"
                + "            }\n"
                + "            System.out.println(\"Applet executed in headless mode.\");\n"
                + "        } catch (Throwable t) {\n"
                + "            Throwable cause = (t instanceof java.lang.reflect.InvocationTargetException && t.getCause() != null)\n"
                + "                ? t.getCause()\n"
                + "                : t;\n"
                + "            if (cause instanceof java.awt.HeadlessException) {\n"
                + "                System.out.println(\"Applet compiled successfully (headless runtime skipped).\");\n"
                + "                return;\n"
                + "            }\n"
                + "            t.printStackTrace();\n"
                + "            System.exit(1);\n"
                + "        }\n"
                + "    }\n"
                + "}\n";
    }

    private static String buildMainLauncherCode(String packageName, String mainFqcn) {
        String packageDecl = packageName != null ? "package " + packageName + ";\n" : "";
        return packageDecl + "public class __RunnerLauncher {\n"
                + "    public static void main(String[] args) {\n"
                + "        try {\n"
                + "            java.lang.reflect.Method mainMethod = Class.forName(\"" + mainFqcn
                + "\").getMethod(\"main\", String[].class);\n"
                + "            mainMethod.invoke(null, (Object) args);\n"
                + "        } catch (Throwable t) {\n"
                + "            Throwable cause = (t instanceof java.lang.reflect.InvocationTargetException && t.getCause() != null)\n"
                + "                ? t.getCause()\n"
                + "                : t;\n"
                + "            if (cause instanceof java.awt.HeadlessException) {\n"
                + "                System.out.println(\"GUI execution skipped in headless environment.\");\n"
                + "                return;\n"
                + "            }\n"
                + "            cause.printStackTrace();\n"
                + "            System.exit(1);\n"
                + "        }\n"
                + "    }\n"
                + "}\n";
    }

    private static String createMainLauncher(Path dir, String mainFqcn) throws IOException {
        String packageName = null;
        int lastDot = mainFqcn.lastIndexOf('.');
        if (lastDot > 0) {
            packageName = mainFqcn.substring(0, lastDot);
        }

        String launcherCode = buildMainLauncherCode(packageName, mainFqcn);
        Path launcherPath = resolveSafePath(dir, "__RunnerLauncher.java");
        Files.writeString(launcherPath, launcherCode, StandardCharsets.UTF_8);
        return packageName == null ? "__RunnerLauncher" : packageName + ".__RunnerLauncher";
    }

    private static String createAppletLauncher(Path dir, String appletFqcn) throws IOException {
        String packageName = null;
        int lastDot = appletFqcn.lastIndexOf('.');
        if (lastDot > 0) {
            packageName = appletFqcn.substring(0, lastDot);
        }

        String launcherCode = buildAppletLauncherCode(packageName, appletFqcn);
        Path launcherPath = resolveSafePath(dir, "__RunnerLauncher.java");
        Files.writeString(launcherPath, launcherCode, StandardCharsets.UTF_8);
        return packageName == null ? "__RunnerLauncher" : packageName + ".__RunnerLauncher";
    }

    private static String resolveRunClassName(Path dir, String preferredFile) {
        String preferredClass = resolveMainClassFromFile(dir, preferredFile);
        if (preferredClass != null) {
            try {
                return createMainLauncher(dir, preferredClass);
            } catch (IOException e) {
                return null;
            }
        }

        String preferredApplet = resolveAppletClassFromFile(dir, preferredFile);
        if (preferredApplet != null) {
            try {
                return createAppletLauncher(dir, preferredApplet);
            } catch (IOException e) {
                return null;
            }
        }

        try {
            for (String relativePath : listJavaFiles(dir)) {
                String className = resolveMainClassFromFile(dir, relativePath);
                if (className != null) {
                    return createMainLauncher(dir, className);
                }
            }

            for (String relativePath : listJavaFiles(dir)) {
                String appletClass = resolveAppletClassFromFile(dir, relativePath);
                if (appletClass != null) {
                    return createAppletLauncher(dir, appletClass);
                }
            }
        } catch (IOException e) {
            return null;
        }

        return null;
    }

    private static void executeSession(Path dir, String mainFileHint) {
        try {
            String runClassName = resolveRunClassName(dir, mainFileHint);
            if (runClassName == null || runClassName.isEmpty()) {
                System.err.println(RED + "❌ No class with a main method or applet entry was found." + RESET);
                return;
            }

            List<String> javaFiles = listJavaFiles(dir);
            if (javaFiles.isEmpty()) {
                System.err.println(RED + "❌ No Java files found to compile." + RESET);
                return;
            }

            List<String> compileCmd = new ArrayList<>();
            compileCmd.add("javac");
            compileCmd.add("-g:none");
            compileCmd.addAll(javaFiles);

            // Compile recursively so package-based paths are supported.
            ProcessBuilder compilePb = new ProcessBuilder(compileCmd);
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
                "ulimit -t " + CPU_LIMIT + " && java -XX:TieredStopAtLevel=1 -cp . " + runClassName);
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