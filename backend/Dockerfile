FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM alpine:3.22
RUN apk add --no-cache ca-certificates && adduser -D -H app && mkdir -p /app/media/signs && chown -R app /app
COPY --from=build /out/api /usr/local/bin/api
WORKDIR /app
USER app
# Sign videos (SIGN_MEDIA_DIR defaults to media/signs); mount a volume here.
VOLUME /app/media/signs
EXPOSE 8080
ENTRYPOINT ["api"]
