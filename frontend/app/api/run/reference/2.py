def main():
    # Read initial queue elements
    queue = list(map(int, input().split()))

    # Read element to enqueue
    x = int(input())
    queue.append(x)

    # Print queue after enqueue
    print(*queue)

    # Dequeue two elements (remove from front)
    for _ in range(2):
        if queue:
            queue.pop(0)

    # Print queue after dequeue
    print(*queue)


if __name__ == "__main__":
    main()
