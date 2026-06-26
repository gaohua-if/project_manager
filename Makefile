VERSION := $(shell cat VERSION 2>/dev/null || echo 0.1.0)
GO_DOCKER_IMAGE ?= golang:1.26-alpine

AIDA_RELEASE_URL ?= http://localhost:5080/statics-live/aida
AIDA_API_URL ?= http://localhost:8080/api/v1
RELEASE_DIR ?= ./aida-releases

.PHONY: version build-linux release-dir release-archive clean

version:
	@echo "aida v$(VERSION)"

build-linux:
	mkdir -p dist
	docker run --rm \
		-v "$(CURDIR):/app" \
		-w /app/daemon \
		$(GO_DOCKER_IMAGE) \
		sh -c 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "-s -w -X main.Version=$(VERSION)" -o /app/dist/aida-linux-amd64 .'

release-dir: build-linux
	rm -rf "$(RELEASE_DIR)"
	mkdir -p "$(RELEASE_DIR)"
	cp dist/aida-linux-amd64 "$(RELEASE_DIR)/aida-linux-amd64"
	cp install.sh "$(RELEASE_DIR)/install.sh"
	sed -i 's|AIDA_RELEASE_URL:-[^}]*|AIDA_RELEASE_URL:-$(AIDA_RELEASE_URL)|' "$(RELEASE_DIR)/install.sh"
	chmod 755 "$(RELEASE_DIR)/install.sh"
	echo "$(VERSION)" > "$(RELEASE_DIR)/aida-latest.txt"
	cd "$(RELEASE_DIR)" && sha256sum aida-linux-amd64 install.sh aida-latest.txt > SHA256SUMS.txt
	@echo "release directory ready: $(RELEASE_DIR)"
	@echo "publish its contents to: $(AIDA_RELEASE_URL)"
	@echo "install command:"
	@echo "  curl -fsSL $(AIDA_RELEASE_URL)/install.sh | AIDA_API_URL=$(AIDA_API_URL) AIDA_TOKEN=<jwt> bash"

release-archive: release-dir
	tar -czf aida_release_$(VERSION)_linux_amd64.tar.gz -C "$(RELEASE_DIR)" .
	@ls -lh aida_release_$(VERSION)_linux_amd64.tar.gz

clean:
	rm -rf dist "$(RELEASE_DIR)" aida_release_*.tar.gz
