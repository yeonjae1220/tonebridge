FROM ghcr.io/cirruslabs/flutter:stable AS builder

WORKDIR /app
COPY pubspec.yaml pubspec.lock ./
RUN flutter pub get

COPY . .

ARG GOOGLE_CLIENT_ID=""
ARG API_BASE_URL="https://tonebridge.mungji.com"

RUN flutter build web --release \
    --dart-define=GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
    --dart-define=API_BASE_URL="${API_BASE_URL}"

FROM nginx:alpine
COPY --from=builder /app/build/web /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
