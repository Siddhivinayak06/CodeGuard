# Stage 1: Build the optimized wrapper
FROM gcc:12.2 AS builder
WORKDIR /build
COPY interactive_wrapper.c .
RUN gcc -O3 -pipe -static-libgcc interactive_wrapper.c -o interactive_wrapper.out

# Stage 2: Final runtime image
FROM debian:bookworm-slim

# Install runtime dependencies, compiler, and ccache
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    coreutils \
    procps \
    time \
    gcc \
    g++ \
    ccache \
    && rm -rf /var/lib/apt/lists/*

# Create runner user
RUN useradd -m -u 1000 -s /bin/bash runner

# Configure ccache
ENV CCACHE_DIR=/app/workspace/.ccache
RUN mkdir -p /app/workspace/.ccache && chown -R runner:runner /app/workspace

WORKDIR /app
COPY --from=builder /build/interactive_wrapper.out .
RUN chown runner:runner /app/interactive_wrapper.out && \
    chmod 755 /app/interactive_wrapper.out

# Create workspace
RUN mkdir -p /app/workspace && chown runner:runner /app/workspace

USER runner
WORKDIR /app

# Keep container alive for hot-pooling and docker exec
CMD ["tail", "-f", "/dev/null"]