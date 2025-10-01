#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <errno.h>
#include <termios.h>

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
    
 
    
    int status = system(EXEC_FILE);
    
    // Disable echo after program finishes
    disable_echo();
    
    printf("\n✅ Program finished (exit code: %d)\n", WEXITSTATUS(status));
    fflush(stdout);
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
    
    printf("✅ Ready\n");
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