# Block directives unit tests

Unit tests for the block loader, block directive, and related schema/registry/ref logic. This folder is **not** included in the published library package (the package is built from `projects/blocks-studio` only).

## Run tests

From the repository root:

```bash
npm run test:block-directives
```

Coverage (lines, branches, functions, statements) for `projects/blocks-studio/src/lib` (excluding `index.ts` and `*.types.ts`):

```bash
npm run test:block-directives:coverage
```

HTML report: `coverage/block-directives/index.html`

Or with Vitest directly:

```bash
npx vitest run --config tests/block-directives/vitest.config.ts
```

## What’s covered

| Spec | Coverage |
|------|----------|
| `block-description-validate.spec.ts` | `safeParseBlockDescription` (success paths, services/directives/inputs/outputs edge cases, nested `then` / `onError`) |
| `block-description.schema.spec.ts` | `safeParse` re-export smoke, `normalizeServices`, `normalizeDirectives`, `isBlockReference`, `isOutputReference`, `deepMergeBlockDefinition`, `resolveBlockReference` |
| `block-registry.spec.ts` | `BlockRegistryImpl` (register, get, has, unregister, duplicate id) |
| `ref-expressions.spec.ts` | `parseRefPath`, `extractReadonlyRefs`, `isTwoWayRefString`, `classifyTwoWayString`, `parseTwoWayRef` |
| `block-loader.service.spec.ts` | `BlockLoaderService.load` (minimal load, inputs, block reference, duplicate id, updateInputs) |
| `block.directive.spec.ts` | `BlockDirective` (host smoke tests) |
| `block-directive-effect.spec.ts` | `runBlockDirectiveEffect`, `clearBlockDirective` (load, reloadKey, block refs, errors) |
| `block-directive-keys.spec.ts` | `getServicesKey`, `safeJsonKey` |
| `block-bindings.spec.ts` | `getBlockInputsAndOutputs`, `resolveBlockInputsAndOutputs` (host directives, nested inputs) |

## Setup

- **Vitest** with `jsdom` (for Angular TestBed).
- **Angular test environment** is initialized in `setup.ts` so `TestBed` works in loader and directive specs.
- Tests import from the library source via relative paths (`../../projects/blocks-studio/src/lib/...`).
