# Optimized C/C++ runtime using Alpine
FROM alpine:3.19

# Install minimal GCC/G++ toolchain
RUN apk add --no-cache \
    gcc \
    g++ \
    musl-dev \
    coreutils \
    bash

# Set working directory
WORKDIR /app

# Copy the interactive C wrapper
COPY interactive_wrapper.c /app/

# Compile the wrapper with optimizations
RUN gcc -O2 -static /app/interactive_wrapper.c -o /app/interactive_wrapper.out && \
    chmod 755 /app/interactive_wrapper.out && \
    rm /app/interactive_wrapper.c

# Create non-root user
RUN adduser -D -u 1000 runner && \
    mkdir -p /app/workspace && \
    chown -R runner:runner /app

# Switch to non-root user
USER runner
WORKDIR /app

# Keep container alive
CMD ["tail", "-f", "/dev/null"]
