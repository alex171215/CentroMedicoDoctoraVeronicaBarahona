# Design Contracts

## Layering Rules
- routes may call services and serialization helpers only.
- services may call models and extensions.
- models must not import routes or services.

## Determinism Rules
- app composition is centralized in app factory.
- request handlers should produce explicit status codes and JSON contracts.
- service functions should be pure in intent and explicit in side effects.
