#include <dirent.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
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
#define MAX_CPU_TIME 15

// ANSI Colors
#define RED "\033[91m"
#define GREEN "\033[92m"
#define YELLOW "\033[93m"
#define CYAN "\033[96m"
#define BOLD "\033[1m"
#define RESET "\033[0m"

void cleanup_workspace() {
  DIR *d = opendir(WORKSPACE);
  if (!d)
    return;
  struct dirent *dir;
  while ((dir = readdir(d)) != NULL) {
    if (dir->d_type == DT_REG) {
      char path[512];
      snprintf(path, sizeof(path), "%s/%s", WORKSPACE, dir->d_name);
      unlink(path);
    }
  }
  closedir(d);
}

int compile_code() {
  char compile_cmd[1024];
  char *compiler = getenv("COMPILER");
  if (!compiler)
    compiler = "gcc";

  // Build compilation command with ccache and -O0 for speed
  if (strcmp(compiler, "g++") == 0) {
    snprintf(compile_cmd, sizeof(compile_cmd),
             "ccache g++ -O0 -o %s %s/*.cpp 2> %s", EXEC_FILE, WORKSPACE,
             ERROR_FILE);
  } else {
    snprintf(compile_cmd, sizeof(compile_cmd),
             "ccache gcc -O0 -o %s %s/*.c 2> %s", EXEC_FILE, WORKSPACE,
             ERROR_FILE);
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
    struct rlimit cpu_limit;
    cpu_limit.rlim_cur = (rlim_t)MAX_CPU_TIME;
    cpu_limit.rlim_max = (rlim_t)MAX_CPU_TIME;
    setrlimit(RLIMIT_CPU, &cpu_limit);

    // Wall-clock timeout (30s)
    alarm(30);

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
  char current_path[512] = "";

  setvbuf(stdin, NULL, _IONBF, 0);
  setvbuf(stdout, NULL, _IONBF, 0);
  setvbuf(stderr, NULL, _IONBF, 0);

  cleanup_workspace();

  while (fgets(line, sizeof(line), stdin)) {
    line[strcspn(line, "\r\n")] = 0;

    if (strncmp(line, "__FILE_START__", 14) == 0) {
      if (current_file)
        fclose(current_file);
      char *filename = line + 14;
      while (*filename == ' ')
        filename++;
      snprintf(current_path, sizeof(current_path), "%s/%s", WORKSPACE,
               filename);
      current_file = fopen(current_path, "w");
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