FROM ghcr.io/cirruslabs/flutter:stable AS builder

WORKDIR /app
COPY pubspec.yaml pubspec.lock ./
RUN flutter pub get

COPY . .

# Generate code (freezed, riverpod, json_serializable, go_router).
# .g.dart / .freezed.dart files are gitignored and must be produced during the build.
RUN dart run build_runner build --delete-conflicting-outputs

# GOOGLE_CLIENT_ID is a public OAuth identifier — safe to embed in the JS bundle.
# Never pass real server secrets via --dart-define; use backend environment variables instead.
ARG GOOGLE_CLIENT_ID=""
ARG API_BASE_URL="https://tonebridge.mungji.com"
ARG FIREBASE_CONFIGURED="true"
ARG VAPID_KEY=""

RUN flutter build web --release \
    --dart-define=GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
    --dart-define=API_BASE_URL="${API_BASE_URL}" \
    --dart-define=FIREBASE_CONFIGURED="${FIREBASE_CONFIGURED}" \
    --dart-define=VAPID_KEY="${VAPID_KEY}"

FROM nginx:alpine
COPY --from=builder /app/build/web /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
