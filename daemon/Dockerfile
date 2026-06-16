FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /aida .

FROM node:22-alpine
RUN apk add --no-cache ca-certificates git tzdata \
	&& npm install -g @anthropic-ai/claude-code
COPY --from=builder /aida /usr/local/bin/aida
EXPOSE 8090
CMD ["aida", "serve"]
