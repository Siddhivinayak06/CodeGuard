FROM gcc:12.2

RUN apt-get update && apt-get install -y coreutils && rm -rf /var/lib/apt/lists/*

WORKDIR /app
