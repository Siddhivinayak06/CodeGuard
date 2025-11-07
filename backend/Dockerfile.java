# Dockerfile.java
FROM eclipse-temurin:17-jdk

LABEL maintainer="you@example.com"
ENV LANG=C.UTF-8 \
    JAVA_HOME=/usr/local/openjdk \
    PATH="$JAVA_HOME/bin:$PATH" \
    DEBIAN_FRONTEND=noninteractive \
    APT_RETRY_COUNT=5 \
    APT_RETRY_DELAY=3

# Helper: retry wrapper for apt-get to tolerate transient network issues
RUN set -eux; \
    echo '#!/bin/sh' > /usr/local/bin/apt-retry && \
    echo 'n=$1; shift; i=0; until [ "$i" -ge "$n" ]; do if "$@"; then exit 0; fi; i=$((i+1)); echo "apt: attempt $i failed, retrying in ${APT_RETRY_DELAY}s"; sleep ${APT_RETRY_DELAY}; done; exit 1' >> /usr/local/bin/apt-retry && \
    chmod +x /usr/local/bin/apt-retry

# Make sure sources use archive.ubuntu.com if ports.ubuntu.com fails (helps on some platforms)
# We do this BEFORE apt-get update so that builds on hosts with DNS issues for ports.* still work.
RUN set -eux; \
    # If sources.list contains ports.ubuntu.com (used on some arches), try to replace with archive.ubuntu.com
    if grep -q 'ports.ubuntu.com' /etc/apt/sources.list 2>/dev/null || grep -q 'ports.ubuntu.com' /etc/apt/sources.list.d/* 2>/dev/null; then \
        sed -i.bak -E 's#http://ports.ubuntu.com#http://archive.ubuntu.com#g' /etc/apt/sources.list* || true; \
    fi; \
    # Show final sources for debugging
    echo "----- apt sources -----"; sed -n '1,200p' /etc/apt/sources.list || true; echo "-----------------------"

# Install a small toolset used by runner scripts (non-interactive)
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
       locales \
    ; \
    rm -rf /var/lib/apt/lists/*

# Create non-root user "runner" and workspace, create /opt/scripts if absent
RUN set -eux; \
  groupadd -r runner \
  && useradd -r -g runner -m -d /home/runner runner \
  && mkdir -p /workspace /tmp/workspace /home/runner/.cache /opt/scripts \
  && chown -R runner:runner /workspace /tmp/workspace /home/runner /opt/scripts

WORKDIR /workspace

# Optional: if you later add helper scripts into backend/scripts, uncomment:
# COPY --chown=runner:runner ./scripts /opt/scripts

# Make scripts executable (no-op if empty)
RUN chmod -R a+rx /opt/scripts || true

# Run as non-root for safety
USER runner

# Keep container alive so you can exec into it or use it as a runtime image
CMD ["tail", "-f", "/dev/null"]
