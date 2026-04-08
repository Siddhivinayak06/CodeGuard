#include <ctype.h>
#include <dirent.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <termios.h>
#include <unistd.h>

#define MAX_LINE 4096
#define WORKSPACE "/app/workspace"
#define EXEC_FILE "/app/workspace/user_program"
#define ERROR_FILE "/app/workspace/compile_errors.txt"
// MAX_CPU_TIME removed, reading from env now

#ifndef PATH_MAX
#define PATH_MAX 4096
#endif

// ANSI Colors
#define RED "\033[91m"
#define GREEN "\033[92m"
#define YELLOW "\033[93m"
#define CYAN "\033[96m"
#define BOLD "\033[1m"
#define RESET "\033[0m"

int remove_path_recursive(const char *path) {
  struct stat st;
  if (lstat(path, &st) != 0) {
    return -1;
  }

  if (S_ISDIR(st.st_mode)) {
    DIR *d = opendir(path);
    if (!d) {
      return -1;
    }

    struct dirent *entry;
    while ((entry = readdir(d)) != NULL) {
      if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) {
        continue;
      }

      char child_path[PATH_MAX];
      snprintf(child_path, sizeof(child_path), "%s/%s", path, entry->d_name);
      remove_path_recursive(child_path);
    }

    closedir(d);
    return rmdir(path);
  }

  return unlink(path);
}

void cleanup_workspace() {
  DIR *d = opendir(WORKSPACE);
  if (!d)
    return;

  struct dirent *entry;
  while ((entry = readdir(d)) != NULL) {
    if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) {
      continue;
    }

    char path[PATH_MAX];
    snprintf(path, sizeof(path), "%s/%s", WORKSPACE, entry->d_name);
    remove_path_recursive(path);
  }

  closedir(d);
}

void normalize_relative_path(const char *src, char *dest, size_t dest_size,
                            const char *default_name) {
  size_t j = 0;
  int seen_non_slash = 0;

  if (!src)
    src = "";

  for (size_t i = 0; src[i] != '\0' && j < dest_size - 1; i++) {
    char c = src[i];
    if (c == '\\')
      c = '/';

    if (!seen_non_slash && c == '/')
      continue;

    if (!seen_non_slash && c != '/')
      seen_non_slash = 1;

    dest[j++] = c;
  }

  dest[j] = '\0';

  if (j == 0 && default_name) {
    snprintf(dest, dest_size, "%s", default_name);
  }
}

int is_safe_relative_path(const char *path) {
  if (!path || path[0] == '\0' || path[0] == '/')
    return 0;

  if (strstr(path, ".."))
    return 0;

  for (size_t i = 0; path[i] != '\0'; i++) {
    unsigned char c = (unsigned char)path[i];
    if (!(isalnum(c) || c == '_' || c == '-' || c == '.' || c == '/')) {
      return 0;
    }
  }

  return 1;
}

int ensure_parent_dirs(const char *full_path) {
  char temp[PATH_MAX];
  size_t len = strlen(full_path);
  if (len >= sizeof(temp)) {
    return -1;
  }

  strcpy(temp, full_path);

  for (char *p = temp + 1; *p; p++) {
    if (*p == '/') {
      *p = '\0';
      if (mkdir(temp, 0755) != 0 && errno != EEXIST) {
        return -1;
      }
      *p = '/';
    }
  }

  return 0;
}

const char *default_source_file() {
  char *compiler = getenv("COMPILER");
  return (compiler && strcmp(compiler, "g++") == 0) ? "main.cpp" : "main.c";
}

int has_ccache() {
  return system("command -v ccache >/dev/null 2>&1") == 0;
}

int compile_code() {
  char compile_cmd[1024];
  char *compiler = getenv("COMPILER");
  if (!compiler)
    compiler = "gcc";

  const char *cache_prefix = has_ccache() ? "ccache " : "";

  // Build compilation command and compile all source files under workspace.
  if (strcmp(compiler, "g++") == 0) {
    snprintf(compile_cmd, sizeof(compile_cmd),
             "sh -c 'files=$(find \"%s\" -type f | grep -E \"\\\\.(cpp|cc|cxx)$\" || true); "
             "if [ -z \"$files\" ]; then echo \"No C++ source files found\" >&2; exit 1; fi; "
             "%sg++ -O0 -I \"%s\" -o \"%s\" $files 2> \"%s\"'",
             WORKSPACE, cache_prefix, WORKSPACE, EXEC_FILE, ERROR_FILE);
  } else {
    snprintf(compile_cmd, sizeof(compile_cmd),
             "sh -c 'files=$(find \"%s\" -type f | grep -E \"\\\\.c$\" || true); "
             "if [ -z \"$files\" ]; then echo \"No C source files found\" >&2; exit 1; fi; "
             "%sgcc -O0 -I \"%s\" -o \"%s\" $files 2> \"%s\"'",
             WORKSPACE, cache_prefix, WORKSPACE, EXEC_FILE, ERROR_FILE);
  }

  int ret = system(compile_cmd);

  if (ret != 0) {
    printf("%s❌ Compilation failed%s\n", RED, RESET);
    FILE *err_file = fopen(ERROR_FILE, "r");
    if (err_file) {
      char line[MAX_LINE];
      while (fgets(line, sizeof(line), err_file)) {
        printf("%s", line);
      }
      fclose(err_file);
    }
    printf("\n");
    return -1;
  }

  chmod(EXEC_FILE, 0755);
  printf("%s✅ Compilation successful%s\n", GREEN, RESET);
  return 0;
}

void run_code() {
  printf("\n");
  pid_t pid = fork();
  if (pid == 0) {
    // Child
    const char *timeout_env = getenv("EXECUTION_TIMEOUT");
    int timeout_sec = timeout_env ? atoi(timeout_env) : 15;

    struct rlimit cpu_limit;
    cpu_limit.rlim_cur = (rlim_t)timeout_sec;
    cpu_limit.rlim_max = (rlim_t)timeout_sec;
    setrlimit(RLIMIT_CPU, &cpu_limit);

    // Wall-clock timeout
    alarm(timeout_sec);

    execl(EXEC_FILE, EXEC_FILE, NULL);
    perror(RED "❌ Execution failed" RESET);
    exit(1);
  } else if (pid > 0) {
    int status;
    waitpid(pid, &status, 0);
    if (WIFEXITED(status)) {
      printf("\n...Program finished with exit code %d\n", WEXITSTATUS(status));
    } else if (WIFSIGNALED(status)) {
      if (WTERMSIG(status) == SIGXCPU) {
        printf("\n⏱️ Program killed - CPU time limit exceeded\n");
      } else if (WTERMSIG(status) == SIGALRM) {
        printf("\n⏱️ Program killed - Wall-clock timeout exceeded\n");
      } else {
        printf("\n%s...Program killed by signal %d%s\n", YELLOW,
               WTERMSIG(status), RESET);
      }
    }
  } else {
    perror("❌ Fork failed");
  }
}

int main() {
  char line[MAX_LINE];
  FILE *current_file = NULL;
  char current_path[PATH_MAX] = "";
  int expecting_new_batch = 1;

  setvbuf(stdin, NULL, _IONBF, 0);
  setvbuf(stdout, NULL, _IONBF, 0);
  setvbuf(stderr, NULL, _IONBF, 0);

  cleanup_workspace();

  while (fgets(line, sizeof(line), stdin)) {
    line[strcspn(line, "\r\n")] = 0;

    if (strncmp(line, "__FILE_START__", 14) == 0) {
      if (expecting_new_batch) {
        cleanup_workspace();
        expecting_new_batch = 0;
      }

      if (current_file)
        fclose(current_file);

      char *filename = line + 14;
      while (*filename == ' ')
        filename++;

      char normalized[PATH_MAX];
      normalize_relative_path(filename, normalized, sizeof(normalized),
                              default_source_file());

      if (!is_safe_relative_path(normalized)) {
        printf("%s❌ Invalid file path: %s%s\n", RED, normalized, RESET);
        current_file = NULL;
        continue;
      }

      snprintf(current_path, sizeof(current_path), "%s/%s", WORKSPACE,
               normalized);

      if (ensure_parent_dirs(current_path) != 0) {
        printf("%s❌ Failed to create parent directories for %s%s\n", RED,
               normalized, RESET);
        current_file = NULL;
        continue;
      }

      current_file = fopen(current_path, "w");
      if (!current_file) {
        printf("%s❌ Failed to open %s: %s%s\n", RED, normalized,
               strerror(errno), RESET);
      }
      continue;
    }

    if (strcmp(line, "__CODE_START__") == 0) {
      // Legacy support or sentinel for starting code block
      continue;
    }

    if (strcmp(line, "__RUN_CODE__") == 0) {
      if (current_file) {
        fclose(current_file);
        current_file = NULL;
      }
      if (compile_code() == 0) {
        run_code();
      }
      printf("\n%s--- Execution Finished ---%s\n", CYAN, RESET);
      expecting_new_batch = 1;
      continue;
    }

    if (current_file) {
      fprintf(current_file, "%s\n", line);
      fflush(current_file);
    }
  }

  if (current_file)
    fclose(current_file);
  return 0;
}