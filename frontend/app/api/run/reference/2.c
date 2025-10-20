#include <stdio.h>

int main() {
    int queue[1000], n = 0, x;
    
    // Read initial queue elements
    while (scanf("%d", &queue[n]) == 1) {
        n++;
        if (getchar() == '\n') break;
    }

    // Read element to enqueue
    scanf("%d", &x);
    queue[n++] = x;

    // Print queue after enqueue
    for (int i = 0; i < n; i++)
        printf("%d ", queue[i]);
    printf("\n");

    // Dequeue two elements (remove from front)
    int start = 2;
    if (start > n) start = n;

    for (int i = start; i < n; i++)
        printf("%d ", queue[i]);
    printf("\n");

    return 0;
}
