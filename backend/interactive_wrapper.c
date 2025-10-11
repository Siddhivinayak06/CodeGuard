#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <sys/resource.h>
#include <errno.h>
#include <termios.h>
#include <signal.h>
#include <sys/types.h>

#define MAX_LINE 4096
#define CODE_FILE "/app/workspace/user_code.c"
#define EXEC_FILE "/app/workspace/user_program"
#define ERROR_FILE "/app/workspace/compile_errors.txt"
#define MAX_CPU_TIME 3

void cleanup_files() {
    unlink(CODE_FILE);
    unlink(EXEC_FILE);
    unlink(ERROR_FILE);
}
 
int compile_code() {
    char compile_cmd[512];
    snprintf(compile_cmd, sizeof(compile_cmd), 
             "gcc -o %s %s 2> %s", 
             EXEC_FILE, CODE_FILE, ERROR_FILE);
    
    int ret = system(compile_cmd);
    
    if (ret != 0) {
        printf("❌ Compilation failed\n");
        
        FILE *err_file = fopen(ERROR_FILE, "r");
        if (err_file) {
            char line[MAX_LINE];
            while (fgets(line, sizeof(line), err_file)) {
                printf("%s", line);
            }
            fclose(err_file);
        }
        printf("\n");
        fflush(stdout);
        return -1;
    }
    
    chmod(EXEC_FILE, 0755);
    printf("✅ Compilation successful\n");
    fflush(stdout);
    return 0;
}

void run_code() {
    printf("\n");
    fflush(stdout);

    pid_t pid = fork();
    if (pid == 0) {
        // Child process: Disable echo
        struct termios tty;
        if (tcgetattr(STDIN_FILENO, &tty) == 0) {
            tty.c_lflag &= ~ECHO;
            tcsetattr(STDIN_FILENO, TCSANOW, &tty);
        }
        
        // Set CPU time limit
        struct rlimit cpu_limit;
        cpu_limit.rlim_cur = (rlim_t)MAX_CPU_TIME;
        cpu_limit.rlim_max = (rlim_t)MAX_CPU_TIME;
        
        if (setrlimit(RLIMIT_CPU, &cpu_limit) != 0) {
            fprintf(stderr, "Warning: Could not set CPU limit\n");
        }
        
        // Execute the program
        execl(EXEC_FILE, EXEC_FILE, NULL);
        printf("❌ Failed to execute program\n");
        fflush(stdout);
        exit(1);
    } else if (pid > 0) {
        // Parent process: simply wait
        int status;
        waitpid(pid, &status, 0);

        if (WIFEXITED(status)) {
            int exit_code = WEXITSTATUS(status);
            printf("\n...Program finished with exit code %d\n", exit_code);
        } else if (WIFSIGNALED(status)) {
            int sig = WTERMSIG(status);
            if (sig == SIGXCPU) {
                printf("\n⏱️ Program killed - CPU time limit exceeded (infinite loop detected)\n");
            } else {
                printf("\n...Program killed due to timeout");
            }
        }
        fflush(stdout);
    } else {
        printf("❌ Failed to fork process\n");
        fflush(stdout);
    }
}

int main() {
    char line[MAX_LINE];
    FILE *code_file = NULL;
    int collecting_code = 0;
    
    setbuf(stdin, NULL);
    setbuf(stdout, NULL);
    setbuf(stderr, NULL);
    
    if (access("/app/workspace", W_OK) != 0) {
        printf("❌ Error: /app/workspace is not writable\n");
        fflush(stdout);
        return 1;
    }
    
    while (fgets(line, sizeof(line), stdin)) {
        line[strcspn(line, "\r\n")] = 0;
        
        if (strlen(line) == 0) {
            continue;
        }
        
        if (strcmp(line, "__CODE_START__") == 0) {
            collecting_code = 1;
            cleanup_files();
            
                

            code_file = fopen(CODE_FILE, "w");
            if (!code_file) {
                printf("❌ Error: Could not create code file\n");
                fflush(stdout);
                collecting_code = 0;
            }
            
            continue;
        }
        
        if (strcmp(line, "__RUN_CODE__") == 0) {
            if (code_file) {
                fclose(code_file);
                code_file = NULL;
            }
            
            collecting_code = 0;
            
             

            struct stat st;
            if (stat(CODE_FILE, &st) != 0 || st.st_size == 0) {
                printf("❌ Error: No code to compile\n");
                fflush(stdout);
                continue;
            }
            
            if (compile_code() == 0) {
                run_code();
            }
            
            cleanup_files();
            fflush(stdout);
            continue;
        }
        
        if (collecting_code && code_file) {
            fprintf(code_file, "%s\n", line);
            fflush(code_file);
        }
    }
    
    if (code_file) {
        fclose(code_file);
    }
    
    cleanup_files();
    return 0;
}