# Test-only build from the same upstream source release as production.
# Upstream binary container registries no longer serve this release.
FROM golang:1.27.4-bookworm AS build
WORKDIR /src
RUN curl -fsSL https://codeload.github.com/minio/minio/tar.gz/refs/tags/RELEASE.2025-04-08T15-41-24Z -o /tmp/minio.tar.gz \
 && echo "505633bdcb3bf07792ebabd2dfe8d89c45fe23b6d83b1ae94c6778a9f9f3fcc1  /tmp/minio.tar.gz" | sha256sum -c - \
 && tar -xzf /tmp/minio.tar.gz --strip-components=1 -C /src
RUN CGO_ENABLED=0 go build -trimpath -o /minio .
FROM debian:bookworm-slim
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /minio /usr/local/bin/minio
ENTRYPOINT ["/usr/local/bin/minio"]
