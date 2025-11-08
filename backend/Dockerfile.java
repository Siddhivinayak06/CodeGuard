FROM eclipse-temurin:17-jdk

LABEL maintainer="you@example.com"

ENV LANG=C.UTF-8 \
    JAVA_HOME=/usr/local/openjdk \
    PATH="$JAVA_HOME/bin:$PATH" \
    DEBIAN_FRONTEND=noninteractive \
    APT_RETRY_COUNT=5 \
    APT_RETRY_DELAY=3

# Retry helper
RUN set -eux; \
    echo '#!/bin/sh' > /usr/local/bin/apt-retry; \
    echo 'n=$1; shift; i=0; while [ "$i" -lt "$n" ]; do if "$@"; then exit 0; fi; i=$((i+1)); echo "apt: attempt $i failed, retrying in ${APT_RETRY_DELAY}s"; sleep ${APT_RETRY_DELAY}; done; exit 1' >> /usr/local/bin/apt-retry; \
    chmod +x /usr/local/bin/apt-retry

# Replace ports.* with archive.* if present
RUN set -eux; \
    if grep -q 'ports.ubuntu.com' /etc/apt/sources.list 2>/dev/null || \
       grep -q 'ports.ubuntu.com' /etc/apt/sources.list.d/* 2>/dev/null; then \
        sed -i.bak -E 's#http://ports.ubuntu.com#http://archive.ubuntu.com#g' /etc/apt/sources.list* || true; \
    fi; \
    echo "----- apt sources -----"; sed -n '1,200p' /etc/apt/sources.list || true; echo "-----------------------"

# Install minimal toolchain
RUN set -eux; \
    /usr/local/bin/apt-retry ${APT_RETRY_COUNT} apt-get update; \
    /usr/local/bin/apt-retry ${APT_RETRY_COUNT} apt-get install -y --no-install-recommends \
       ca-certificates \
       curl \
       procps \
       git \
       make \
       build-essential \
       unzip \
       zip \
       netcat-openbsd \
       locales; \
    rm -rf /var/lib/apt/lists/*

# Create runner user & workspace
RUN set -eux; \
    groupadd -r runner; \
    useradd -r -g runner -m -d /home/runner runner; \
    mkdir -p /workspace /app /tmp/workspace /home/runner/.cache /opt/scripts; \
    chown -R runner:runner /workspace /tmp/workspace /home/runner /opt/scripts

WORKDIR /workspace

# ---------- COPY + BUILD interactive wrapper ----------
# Copy source into image and compile it during build (as root).
# Ensure you have InteractiveWrapper.java next to this Dockerfile.
COPY InteractiveWrapper.java /app/InteractiveWrapper.java

# Compile and package into a runnable jar (Main-Class InteractiveWrapper).
# We run javac as root here (image build), then create a jar with entrypoint.
RUN set -eux; \
    cd /app; \
    javac InteractiveWrapper.java; \
    # create jar with Main-Class=InteractiveWrapper
    jar cfe interactive_wrapper.jar InteractiveWrapper *.class; \
    # list contents for debug
    echo "Contents of /app:"; ls -la /app

# Make the /app directory and jar owned by runner, so a non-root runtime can access it
RUN chown -R runner:runner /app || true
# -----------------------------------------------------

# Optional: copy helper scripts (uncomment if you have them)
# COPY --chown=runner:runner ./scripts /opt/scripts

RUN chmod -R a+rx /opt/scripts || true

# Switch to non-root
USER runner

# Keep container alive by default (server.js uses docker exec to run wrapper)
CMD ["tail", "-f", "/dev/null"]
