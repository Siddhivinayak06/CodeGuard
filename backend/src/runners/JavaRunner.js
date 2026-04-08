/**
 * Java Code Runner
 */

const BaseRunner = require('./BaseRunner');
const config = require('../config');

class JavaRunner extends BaseRunner {
  get language() {
    return 'java';
  }

  get image() {
    return 'codeguard-java';
  }

  get memoryLimit() {
    return config.docker.javaMemory;
  }

  get pidsLimit() {
    return config.docker.javaPidsLimit;
  }

  /**
   * Build Java execution command (compile + run)
   * Handles class name detection and launcher generation
   * @param {string} code - Java source code
   * @param {Object} testCase - Test case data
   * @param {string} uniqueId - Unique identifier for temp files
   * @param {number} timeoutSec - Timeout in seconds
   * @returns {string}
   */
  buildCommand(code, testCase, uniqueId, timeoutSec) {
    const { stdinInput = '' } = testCase;

    // Parse class name and package from the Node side for robust extraction
    const pkgMatch = code.match(/^\s*package\s+([a-zA-Z0-9_.]+)\s*;/m);
    const pkgName = pkgMatch ? pkgMatch[1] : null;

    let compileClassName = 'Main';
    const publicClassMatch = code.match(
      /^(?:public\s+class\s+([A-Za-z_][A-Za-z0-9_]*))/m
    );
    if (publicClassMatch) {
      compileClassName = publicClassMatch[1];
    } else {
      const classMatch = code.match(/^(?:class\s+([A-Za-z_][A-Za-z0-9_]*))/m);
      if (classMatch) compileClassName = classMatch[1];
    }

    const hasMain = /public\s+static\s+void\s+main\s*\(/.test(code);
    const appletClassMatch = code.match(
      /(?:public\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)\s+extends\s+(?:java\.applet\.Applet|javax\.swing\.JApplet|Applet|JApplet)\b/
    );
    let runClassName = compileClassName;
    let runClassFqcn = pkgName ? `${pkgName}.${runClassName}` : runClassName;

    if (hasMain) {
      const mainIndex = code.search(/\bpublic\s+static\s+void\s+main\s*\(/);
      if (mainIndex !== -1) {
        const classRegex = /^(?:public\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
        const beforeMain = code.slice(0, mainIndex);
        let match;
        let lastClassBeforeMain = null;

        while ((match = classRegex.exec(beforeMain)) !== null) {
          lastClassBeforeMain = match[1];
        }

        if (lastClassBeforeMain) {
          runClassName = lastClassBeforeMain;
          runClassFqcn = pkgName ? `${pkgName}.${runClassName}` : runClassName;
        }
      }
    }

    let wrapperCode = '';
    if (hasMain) {
      wrapperCode = `
  ${pkgName ? `package ${pkgName};` : ''}
  public class __RunnerLauncher {
    private static java.io.InputStream nonClosingStdIn() {
      return new java.io.FilterInputStream(System.in) {
        @Override
        public void close() throws java.io.IOException {
          // Keep stdin available even if user code calls Scanner.close().
        }
      };
    }
    public static void main(String[] args) {
      try {
        System.setIn(nonClosingStdIn());
        java.lang.reflect.Method mainMethod =
          Class.forName("${runClassFqcn}").getMethod("main", String[].class);
        mainMethod.invoke(null, (Object) args);
      } catch (Throwable t) {
        Throwable cause = (t instanceof java.lang.reflect.InvocationTargetException && t.getCause() != null)
          ? t.getCause()
          : t;
        if (cause instanceof java.awt.HeadlessException) {
          System.out.println("GUI execution skipped in headless environment.");
          return;
        }
        cause.printStackTrace();
        System.exit(1);
      }
    }
  }
      `.trim();
      runClassFqcn = pkgName
        ? `${pkgName}.__RunnerLauncher`
        : '__RunnerLauncher';
    } else if (appletClassMatch?.[1]) {
      const appletClassName = appletClassMatch[1];
      const appletFqcn = pkgName
        ? `${pkgName}.${appletClassName}`
        : appletClassName;

      wrapperCode = `
${pkgName ? `package ${pkgName};` : ''}
    public class __RunnerLauncher {
    public static void main(String[] args) {
        System.setProperty("java.awt.headless", "true");
        try {
            Object instance = Class.forName("${appletFqcn}").getDeclaredConstructor().newInstance();
            if (instance instanceof java.applet.Applet) {
                java.applet.Applet applet = (java.applet.Applet) instance;
                applet.init();
                applet.start();
                java.awt.image.BufferedImage canvas = new java.awt.image.BufferedImage(
                    1,
                    1,
                    java.awt.image.BufferedImage.TYPE_INT_ARGB
                );
                java.awt.Graphics2D g = canvas.createGraphics();
                applet.paint(g);
                g.dispose();
            }
            System.out.println("Applet executed in headless mode.");
        } catch (Throwable t) {
            Throwable cause = (t instanceof java.lang.reflect.InvocationTargetException && t.getCause() != null)
              ? t.getCause()
              : t;
            if (cause instanceof java.awt.HeadlessException) {
              System.out.println("Applet compiled successfully (headless runtime skipped).");
              return;
            }
            t.printStackTrace();
            System.exit(1);
        }
    }
}
      `.trim();
      runClassFqcn = pkgName
        ? `${pkgName}.__RunnerLauncher`
        : '__RunnerLauncher';
    }

    return `
mkdir -p /tmp/${uniqueId} &&
${this.writeBase64FileCommand(code, `/tmp/${uniqueId}/${compileClassName}.java`)} &&
${wrapperCode ? this.writeBase64FileCommand(wrapperCode, `/tmp/${uniqueId}/__RunnerLauncher.java`) + ' &&' : ''}
${this.writeBase64FileCommand(stdinInput, `/tmp/${uniqueId}/input.txt`)} &&
javac -d /tmp/${uniqueId} /tmp/${uniqueId}/*.java 2> /tmp/${uniqueId}/compile_err.txt || true &&
if [ -s /tmp/${uniqueId}/compile_err.txt ]; then
  cat /tmp/${uniqueId}/compile_err.txt 1>&2
  exit 1
else
  cat /tmp/${uniqueId}/input.txt | timeout ${timeoutSec} java -XX:+UseSerialGC -Xmx128M -cp /tmp/${uniqueId} ${runClassFqcn}
fi
    `.trim();
  }
}

module.exports = JavaRunner;
