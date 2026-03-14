# Block directives unit tests

Unit tests for the block loader, block directive, and related schema/registry/ref logic. This folder is **not** included in the published library package (the package is built from `projects/blocks-studio` only).

## Run tests

From the repository root:

```bash
npm run test:block-directives
```

Or with Vitest directly:

```bash
npx vitest run --config tests/block-directives/vitest.config.ts
```

## What’s covered

| Spec | Coverage |
|------|----------|
| `block-description.schema.spec.ts` | `safeParseBlockDescription`, `normalizeServices`, `normalizeDirectives`, `isBlockReference`, `isOutputReference`, `deepMergeBlockDefinition`, `resolveBlockReference` |
| `block-registry.spec.ts` | `BlockRegistryImpl` (register, get, has, unregister, duplicate id) |
| `ref-expressions.spec.ts` | `parseRefPath`, `extractReadonlyRefs`, `isTwoWayRefString`, `classifyTwoWayString`, `parseTwoWayRef` |
| `block-loader.service.spec.ts` | `BlockLoaderService.load` (minimal load, inputs, block reference, duplicate id, updateInputs) |
| `block.directive.spec.ts` | `BlockDirective` (host renders, description accepted, clear on null) |

## Setup

- **Vitest** with `jsdom` (for Angular TestBed).
- **Angular test environment** is initialized in `setup.ts` so `TestBed` works in loader and directive specs.
- Tests import from the library source via relative paths (`../../projects/blocks-studio/src/lib/...`).
