#include <stdio.h>

int main() {
    int stack[100], n = 0, x;

    // Read first line of numbers
    while (scanf("%d", &x) == 1) {
        stack[n++] = x;
        int c = getchar();
        if (c == '\n' || c == EOF) break;
    }

    // Read second input (push)
    if (scanf("%d", &x) == 1) {
        stack[n++] = x;
    }

    // Print stack after push
    for (int i = 0; i < n; i++) printf("%d ", stack[i]);
    printf("\n");

    // Pop 2 elements
    if (n >= 2) n -= 2;
    else n = 0;

    // Print stack after pop
    for (int i = 0; i < n; i++) printf("%d ", stack[i]);
    printf("\n");

    return 0;
}
