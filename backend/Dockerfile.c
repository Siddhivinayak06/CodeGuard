FROM gcc:12.2

RUN apt-get update && apt-get install -y coreutils && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Create a non-root user for running code
RUN useradd -m runner
USER runner
