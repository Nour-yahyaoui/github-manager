.PHONY: setup build-web run dev test check

setup:
	cd web && npm install
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created .env from .env.example"; fi

build-web:
	cd web && npm run build

# Production-like local single-port server (http://127.0.0.1:8080)
run: build-web
	cargo run

# Frontend typecheck + unit & WCAG contrast tests
test:
	cd web && npm run typecheck && npm test

check:
	cargo check
	cd web && npm run typecheck
