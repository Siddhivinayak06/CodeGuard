#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <errno.h>
#include <termios.h>
#include <signal.h>
#include <sys/types.h>
 
#include <time.h>


#define MAX_LINE 4096
#define CODE_FILE "/app/workspace/user_code.c"
#define EXEC_FILE "/app/workspace/user_program"
#define ERROR_FILE "/app/workspace/compile_errors.txt"

void cleanup_files() {
    unlink(CODE_FILE);
    unlink(EXEC_FILE);
    unlink(ERROR_FILE);
}

void disable_echo() {
    struct termios tty;
    if (tcgetattr(STDIN_FILENO, &tty) == 0) {
        tty.c_lflag &= ~(ECHO | ECHONL);  // Disable echo
        tty.c_lflag &= ~ICANON;  // Disable canonical mode
        tcsetattr(STDIN_FILENO, TCSANOW, &tty);
    }
}

void enable_echo() {
    struct termios tty;
    if (tcgetattr(STDIN_FILENO, &tty) == 0) {
        tty.c_lflag |= (ECHO | ICANON);  // Enable echo and canonical mode
        tcsetattr(STDIN_FILENO, TCSANOW, &tty);
    }
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
        // Child process: execute the program
        execl(EXEC_FILE, EXEC_FILE, NULL);
        // If execl fails
        printf("❌ Failed to execute program\n");
        fflush(stdout);
        exit(1);
    } else if (pid > 0) {
        // Parent process: wait with timeout
        int status;
        time_t start = time(NULL);
        while (1) {
            pid_t result = waitpid(pid, &status, WNOHANG);
            if (result == pid) break; // finished
            if (difftime(time(NULL), start) > 7.0) { // 5 sec timeout
                kill(pid, SIGKILL);
                printf("\n⏱️ Program killed due to timeout\n");
                fflush(stdout);
                break;
            }
            usleep(100000); // 0.1 sec sleep
        }

        // Disable echo after program finishes
        disable_echo();

        if (WIFEXITED(status)) {
            printf("\n...Program finished with exit code %d\n", WEXITSTATUS(status));
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
    
    // Disable echo initially
    disable_echo();
    
    // Unbuffered I/O
    setbuf(stdin, NULL);
    setbuf(stdout, NULL);
    setbuf(stderr, NULL);
    
    if (access("/app/workspace", W_OK) != 0) {
        printf("❌ Error: /app/workspace is not writable\n");
        fflush(stdout);
        return 1;
    }
    
    fflush(stdout);
    
    while (fgets(line, sizeof(line), stdin)) {
        // Remove trailing newline/carriage return
        line[strcspn(line, "\r\n")] = 0;
        
        // Skip empty lines
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