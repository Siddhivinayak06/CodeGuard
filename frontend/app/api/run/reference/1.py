def main():
    import sys

    # Read first line of numbers
    line1 = sys.stdin.readline().strip()
    stack = list(map(int, line1.split()))

    # Read second input (push)
    line2 = sys.stdin.readline().strip()
    if line2:
        x = int(line2)
        stack.append(x)

    # Print stack after push
    print(" ".join(map(str, stack)))

    # Pop 2 elements
    for _ in range(2):
        if stack:
            stack.pop()

    # Print stack after pop
    print(" ".join(map(str, stack)))


if __name__ == "__main__":
    main()
