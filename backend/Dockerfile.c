FROM gcc:12.2

# Install core tools
RUN apt-get update && \
    apt-get install -y coreutils bsdutils && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy the interactive C wrapper
COPY interactive_wrapper.c /app/

# Compile the wrapper with proper permissions
RUN gcc /app/interactive_wrapper.c -o /app/interactive_wrapper.out && \
    chmod 755 /app/interactive_wrapper.out

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash runner

# Set ownership and permissions for /app
RUN chown -R runner:runner /app && chmod -R 755 /app

# Create workspace directory
RUN mkdir -p /app/workspace

# Switch to non-root user
USER runner
WORKDIR /app

# Default shell
CMD ["/bin/bash"]
