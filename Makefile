PROJECT_NAME := $(shell basename $(PWD))

.PHONY: docs
docs:
	npx typedoc --skipErrorChecking --entryPointStrategy expand --out docs/$(PROJECT_NAME) src
	cd docs && rm -rf html && ln -s $(PROJECT_NAME) html
