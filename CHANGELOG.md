# Changelog

All notable changes to this project will be documented in this file.


## [0.1.0] - 2026-07-06


## ✨ Features

- Add comprehensive documentation for block-directive use cases, covering bindings, services, directive inputs/outputs, and block references. Update README to include new documentation file and enhance clarity on usage examples across the demo app. ([5885e2e4](../../commit/5885e2e4eb1f9b7152dae99d408976c81681e111))
- Add comprehensive unit tests for BlockLoaderService, BlockDirective, and related schemas. Introduce tests for block reference resolution, input handling, and registry management, ensuring robust coverage for new features and functionality. ([dbf2f14e](../../commit/dbf2f14eaf454207aa8a676781cbba788834c59d))
- Enhance documentation for BlockLoaderService and registries to include support for host directives. Update README and related files to reflect changes in input/output validation and directive handling, ensuring clarity on the new directive registry and its integration with block loading. ([2dc322d4](../../commit/2dc322d4989455e7cf9460f6de565786b7e9dded))
- Update block reference syntax to use "BlockID:model.path" format for improved clarity in reference resolution. Enhance documentation and refactor related schemas and services to support the new format, ensuring consistent handling of nested signals and model paths across components. ([3a48bc10](../../commit/3a48bc108dc3a93bce98be9e7334f97a52c0c3d9))
- Enhance BlockLoaderService and BlockDirective to support optional model inputs and improve signal handling. Introduce alias support in service entries and streamline model application across components for better reactivity and flexibility in block management. ([5acd5f78](../../commit/5acd5f78bcd9be1070114b91fa4c74bf824a7160))
- Enhance documentation for output handling in BlockLoader. Added detailed explanations of output references, wiring, and the output reference shape, including source file references for clarity. ([d9a76ff6](../../commit/d9a76ff6dacade2c94a1be8f7414c6de4375ac35))
- Implement BlockDefinitionsRegistry for centralized block definition management. Update BlockLoaderService and BlockDirective to utilize the registry for resolving block references. Enhance demo app with new block templates for login and dashboard, and integrate state management services for improved functionality. ([5570b5a3](../../commit/5570b5a3873c2bd40610e57db4df958daef5279f))
- Refactor BlockLoaderService to improve service type resolution and optimize template interpolation. Introduced parallel fetching of service types and streamlined child injector creation. Enhanced reference path parsing with additional path parts for better context handling. ([4eef133f](../../commit/4eef133feee96f5031c88e209889cb4a5121146b))
- Enhance dynamic component loading by introducing a new demo project configuration in angular.json. Added block loader service and related schemas for improved block management. Updated tsconfig.json to include demo project paths and modified README to reflect changes in documentation structure. Removed outdated dynamic loader documentation. ([959e2fcb](../../commit/959e2fcb1c4930f797bdd59163004a682a1454a5))
- Implement dynamic component loading feature with JSON descriptors. Added core files for dynamic loader, including BlockDirective, DynamicComponentLoaderService, and model expression handling. Updated README and package.json for new dependencies and documentation. Refactored registry to support dynamic service loading. ([92858a5f](../../commit/92858a5fa7ea4eb163633376111f05e70c211062))
- Initial commit of ngx-blocks-studio library, including core functionality for dynamic routing and component/service/guard registries. Added configuration files, documentation, and setup for Angular CLI and TypeScript. ([a88cefe3](../../commit/a88cefe353bafd027c650f02443e4396e6f5933a))

## 🐛 Bug Fixes

- Bump ngx-blocks-studio version to 0.0.9 and enhance documentation for parseRefPath function to clarify single segment handling in reference resolution. ([6e032e0a](../../commit/6e032e0ad21f63fd594bb9b10233f4e9b679315d))
- Simplify BlockLoaderService and ref-resolver by removing unused model handling logic and enhancing signal unwrapping for improved reference resolution. This update streamlines the handling of signals in reference paths and ensures correct property access for nested signals. ([6c6a1820](../../commit/6c6a18209c62ce0039a9243dab38d61383786666))

## ⚡ Performance Improvements

- Refactor block reference resolution to utilize optional per-call definitions and the BlockDefinitionsRegistry. Update BlockLoaderService and BlockDirective to streamline block definition handling, enhancing flexibility in block management. ([5669fd2c](../../commit/5669fd2c6e607e7060bb98ada01a92ed49e4c7bd))

## ♻️ Code Refactoring

- Enhance block input/output resolution and introduce flow template parsing. Update block description schema to support callable output references and improve service resolution in BlockLoaderService. Add flow template functionality for dynamic content rendering. ([209e18c5](../../commit/209e18c59c177e3b55aa01565e4ac4458a019f86))
- Move BlockDefinitionsRegistry to a new registry module, update block reference resolution to support async loaders, and enhance block definition handling in BlockLoaderService. Bump version to 0.0.13. ([ec4cc233](../../commit/ec4cc23320ae1a1c32e8463532aab9c74aefef59))
- Simplify directive registry and update routing configuration. Remove unused AuthState and DashboardState services, streamline home and examples blocks, and adjust default redirect to '/home'. Enhance directive loader function to better distinguish between class constructors and loader functions. ([672fadb4](../../commit/672fadb4aaacb8920c14b11abb4ae7734caeb0c2))
- Update BlockLoaderService and BlockDirective to support enhanced model handling and service entry definitions. Introduce optional alias in service entries, improve type definitions for block inputs, and streamline input management across components for better reactivity and flexibility. ([de7e0c01](../../commit/de7e0c0134e24804adbd160959468e9c739e78a5))
- Refactor BlockLoaderService and BlockDirective to optimize service handling and input updates. Introduced caching for reference path parsing and improved two-way reference classification. Enhanced performance by reducing redundant parsing and managing service keys more efficiently. ([83617475](../../commit/836174759ff8cd472447a3b1681a2e6197381a6e))
- Refactor BlockLoaderService to streamline input handling and remove deprecated two-way model wiring. Consolidated effect references into a single method for improved performance and clarity. Updated related logic for resolving input values. ([a3f69524](../../commit/a3f695242f4bc1e0054ef96c6b1dff32e3c92c33))

## 📚 Documentation

- Update block-directive use cases documentation to clarify refPath handling, service resolution, and input/output behavior. Enhance examples for two-way binding and self-scoped services, ensuring accurate representation of functionality and use cases. ([e6734fb5](../../commit/e6734fb5c8a832f7b9ecc8e6b0e04d98664bfa72))
- Update block reference documentation to clarify usage of blockId and model handling. Enhance descriptions for BlockDirective and BlockLoaderService, emphasizing the role of BlockDefinitionsRegistry and input management for improved clarity and consistency. ([223d3a6c](../../commit/223d3a6c37b17deb4bfb438129825c70001ede8e))
- Enhance BlockLoader and BlockDirective to support block references with optional overrides. Introduced BlockReference interface for improved block management and deep merging of block definitions. Updated documentation to reflect new usage patterns for passing block descriptions and handling overrides. ([6a7eecf4](../../commit/6a7eecf4059f7cf8b79603c5a03c50000e9f9f74))

## 🔧 Chores

- Update package.json and package-lock.json to include @master/css and @master/css-runtime dependencies, bump ngx-blocks-studio version to 0.1.0, and enhance demo application with new CSS configuration and styling improvements. Remove unused styles and streamline component structure for better maintainability. ([68021cce](../../commit/68021cced33b6d0c2ae2cf2f60ebcdef9943a06e))
- Update package.json to include @types/node as a dependency, enhance README with detailed documentation on block descriptions, examples, and concepts, and add new concepts and overview documentation files for better clarity and guidance. ([9f5f2b05](../../commit/9f5f2b051cf5d1872a060377e02c801db37a1b91))
- Update package-lock.json with @types/node and undici-types, modify ng-package.json to allow tslib as a non-peer dependency, and enhance README with clearer documentation. Introduce block-description validation logic and corresponding types for improved block handling. Add unit tests for block-description validation and schema functionality. ([bc6ab449](../../commit/bc6ab4496fa5f16595120e450b27c4d203e54616))
- Bump ngx-blocks-studio version to 0.0.15, enhance block reference resolution in block-bindings, and add ExamplePageBlock definition for improved demo functionality. ([e8bf9358](../../commit/e8bf9358dfb762eb296e7c9612c33460e42ec612))
- Bump ngx-blocks-studio version to 0.0.14 and enhance BlockDefinitionsRegistry to support metadata storage for block definitions. Update registry-metadata to include block definition type and improve metadata handling in the registry. ([f5995c37](../../commit/f5995c3786b6dd80404de63b4dcc5d984a8cf997))
- Bump ngx-blocks-studio version to 0.0.12 and enhance output reference resolution. Introduce safe expression evaluation and improve parameter handling in output references for better dynamic content rendering. ([42164794](../../commit/42164794cf62167baa24b4d7c41577147ff502e8))
- Bump ngx-blocks-studio version to 0.0.11 and introduce block bindings functionality. Add block-bindings.ts for managing inputs and outputs, and refactor BlockLoaderService to utilize new binding methods for improved component interaction and signal handling. ([41a3153f](../../commit/41a3153f5391abc27fe8b830fa14ead0d6950ea8))
- Bump ngx-blocks-studio version to 0.0.8 and update BlockLoaderService to use ResolverContext for improved output handling and reference resolution. ([e66dc95e](../../commit/e66dc95e2d4e2d7a4517d766ce1c9cdc983c7f6d))
- Bump ngx-blocks-studio version to 0.0.7 and update README to reflect new project name and improved documentation structure. ([bc5d1ad0](../../commit/bc5d1ad0c1df8cf7e53aa29fc1bf77dc8e68f093))
- Bump ngx-blocks-studio version to 0.0.5 and update BlockLoaderService to use the view container's injector for improved component hierarchy management. ([368ddf07](../../commit/368ddf07cf59877dbdb33e87c57b318c09ab065a))
- Bump ngx-blocks-studio version to 0.0.4 and refactor BlockLoaderService to enhance service type resolution and streamline injector creation for improved block management. ([205bbb2d](../../commit/205bbb2d150aca993e781bdc3172cb58f841ac04))
- Bump ngx-blocks-studio version to 0.0.2 and update block reference documentation to use blockId instead of id. Refactor block-loader service and related schemas for improved clarity and consistency in block management. ([9f3a1ee0](../../commit/9f3a1ee0c20c6a08dec4235825e5ce132d971607))
- Update Angular dependencies to version 21.2.0 and enhance package scripts for building and publishing the library. Introduce a new script for publishing ngx-blocks-studio to npm with options for dry-run and tagging. ([272f8393](../../commit/272f8393ebb1c3fe3ed04745f9722da0f8a21175))

## Other

- Merge pull request #1 from winghei/staging ([2952e7f6](../../commit/2952e7f624b6f437791e85224f6ff5a67aa8410b))

  Merge staging into main
- Initial commit ([5fc8dbec](../../commit/5fc8dbec4d52cfc8582e849e94e3f9cfdbb8d778))


## [0.0.1] - 2026-07-06


## ✨ Features

- Add comprehensive documentation for block-directive use cases, covering bindings, services, directive inputs/outputs, and block references. Update README to include new documentation file and enhance clarity on usage examples across the demo app. ([5885e2e4](../../commit/5885e2e4eb1f9b7152dae99d408976c81681e111))
- Add comprehensive unit tests for BlockLoaderService, BlockDirective, and related schemas. Introduce tests for block reference resolution, input handling, and registry management, ensuring robust coverage for new features and functionality. ([dbf2f14e](../../commit/dbf2f14eaf454207aa8a676781cbba788834c59d))
- Enhance documentation for BlockLoaderService and registries to include support for host directives. Update README and related files to reflect changes in input/output validation and directive handling, ensuring clarity on the new directive registry and its integration with block loading. ([2dc322d4](../../commit/2dc322d4989455e7cf9460f6de565786b7e9dded))
- Update block reference syntax to use "BlockID:model.path" format for improved clarity in reference resolution. Enhance documentation and refactor related schemas and services to support the new format, ensuring consistent handling of nested signals and model paths across components. ([3a48bc10](../../commit/3a48bc108dc3a93bce98be9e7334f97a52c0c3d9))
- Enhance BlockLoaderService and BlockDirective to support optional model inputs and improve signal handling. Introduce alias support in service entries and streamline model application across components for better reactivity and flexibility in block management. ([5acd5f78](../../commit/5acd5f78bcd9be1070114b91fa4c74bf824a7160))
- Enhance documentation for output handling in BlockLoader. Added detailed explanations of output references, wiring, and the output reference shape, including source file references for clarity. ([d9a76ff6](../../commit/d9a76ff6dacade2c94a1be8f7414c6de4375ac35))
- Implement BlockDefinitionsRegistry for centralized block definition management. Update BlockLoaderService and BlockDirective to utilize the registry for resolving block references. Enhance demo app with new block templates for login and dashboard, and integrate state management services for improved functionality. ([5570b5a3](../../commit/5570b5a3873c2bd40610e57db4df958daef5279f))
- Refactor BlockLoaderService to improve service type resolution and optimize template interpolation. Introduced parallel fetching of service types and streamlined child injector creation. Enhanced reference path parsing with additional path parts for better context handling. ([4eef133f](../../commit/4eef133feee96f5031c88e209889cb4a5121146b))
- Enhance dynamic component loading by introducing a new demo project configuration in angular.json. Added block loader service and related schemas for improved block management. Updated tsconfig.json to include demo project paths and modified README to reflect changes in documentation structure. Removed outdated dynamic loader documentation. ([959e2fcb](../../commit/959e2fcb1c4930f797bdd59163004a682a1454a5))
- Implement dynamic component loading feature with JSON descriptors. Added core files for dynamic loader, including BlockDirective, DynamicComponentLoaderService, and model expression handling. Updated README and package.json for new dependencies and documentation. Refactored registry to support dynamic service loading. ([92858a5f](../../commit/92858a5fa7ea4eb163633376111f05e70c211062))
- Initial commit of ngx-blocks-studio library, including core functionality for dynamic routing and component/service/guard registries. Added configuration files, documentation, and setup for Angular CLI and TypeScript. ([a88cefe3](../../commit/a88cefe353bafd027c650f02443e4396e6f5933a))

## 🐛 Bug Fixes

- Bump ngx-blocks-studio version to 0.0.9 and enhance documentation for parseRefPath function to clarify single segment handling in reference resolution. ([6e032e0a](../../commit/6e032e0ad21f63fd594bb9b10233f4e9b679315d))
- Simplify BlockLoaderService and ref-resolver by removing unused model handling logic and enhancing signal unwrapping for improved reference resolution. This update streamlines the handling of signals in reference paths and ensures correct property access for nested signals. ([6c6a1820](../../commit/6c6a18209c62ce0039a9243dab38d61383786666))

## ⚡ Performance Improvements

- Refactor block reference resolution to utilize optional per-call definitions and the BlockDefinitionsRegistry. Update BlockLoaderService and BlockDirective to streamline block definition handling, enhancing flexibility in block management. ([5669fd2c](../../commit/5669fd2c6e607e7060bb98ada01a92ed49e4c7bd))

## ♻️ Code Refactoring

- Enhance block input/output resolution and introduce flow template parsing. Update block description schema to support callable output references and improve service resolution in BlockLoaderService. Add flow template functionality for dynamic content rendering. ([209e18c5](../../commit/209e18c59c177e3b55aa01565e4ac4458a019f86))
- Move BlockDefinitionsRegistry to a new registry module, update block reference resolution to support async loaders, and enhance block definition handling in BlockLoaderService. Bump version to 0.0.13. ([ec4cc233](../../commit/ec4cc23320ae1a1c32e8463532aab9c74aefef59))
- Simplify directive registry and update routing configuration. Remove unused AuthState and DashboardState services, streamline home and examples blocks, and adjust default redirect to '/home'. Enhance directive loader function to better distinguish between class constructors and loader functions. ([672fadb4](../../commit/672fadb4aaacb8920c14b11abb4ae7734caeb0c2))
- Update BlockLoaderService and BlockDirective to support enhanced model handling and service entry definitions. Introduce optional alias in service entries, improve type definitions for block inputs, and streamline input management across components for better reactivity and flexibility. ([de7e0c01](../../commit/de7e0c0134e24804adbd160959468e9c739e78a5))
- Refactor BlockLoaderService and BlockDirective to optimize service handling and input updates. Introduced caching for reference path parsing and improved two-way reference classification. Enhanced performance by reducing redundant parsing and managing service keys more efficiently. ([83617475](../../commit/836174759ff8cd472447a3b1681a2e6197381a6e))
- Refactor BlockLoaderService to streamline input handling and remove deprecated two-way model wiring. Consolidated effect references into a single method for improved performance and clarity. Updated related logic for resolving input values. ([a3f69524](../../commit/a3f695242f4bc1e0054ef96c6b1dff32e3c92c33))

## 📚 Documentation

- Update block-directive use cases documentation to clarify refPath handling, service resolution, and input/output behavior. Enhance examples for two-way binding and self-scoped services, ensuring accurate representation of functionality and use cases. ([e6734fb5](../../commit/e6734fb5c8a832f7b9ecc8e6b0e04d98664bfa72))
- Update block reference documentation to clarify usage of blockId and model handling. Enhance descriptions for BlockDirective and BlockLoaderService, emphasizing the role of BlockDefinitionsRegistry and input management for improved clarity and consistency. ([223d3a6c](../../commit/223d3a6c37b17deb4bfb438129825c70001ede8e))
- Enhance BlockLoader and BlockDirective to support block references with optional overrides. Introduced BlockReference interface for improved block management and deep merging of block definitions. Updated documentation to reflect new usage patterns for passing block descriptions and handling overrides. ([6a7eecf4](../../commit/6a7eecf4059f7cf8b79603c5a03c50000e9f9f74))

## 🔧 Chores

- Update package.json and package-lock.json to include @master/css and @master/css-runtime dependencies, bump ngx-blocks-studio version to 0.1.0, and enhance demo application with new CSS configuration and styling improvements. Remove unused styles and streamline component structure for better maintainability. ([68021cce](../../commit/68021cced33b6d0c2ae2cf2f60ebcdef9943a06e))
- Update package.json to include @types/node as a dependency, enhance README with detailed documentation on block descriptions, examples, and concepts, and add new concepts and overview documentation files for better clarity and guidance. ([9f5f2b05](../../commit/9f5f2b051cf5d1872a060377e02c801db37a1b91))
- Update package-lock.json with @types/node and undici-types, modify ng-package.json to allow tslib as a non-peer dependency, and enhance README with clearer documentation. Introduce block-description validation logic and corresponding types for improved block handling. Add unit tests for block-description validation and schema functionality. ([bc6ab449](../../commit/bc6ab4496fa5f16595120e450b27c4d203e54616))
- Bump ngx-blocks-studio version to 0.0.15, enhance block reference resolution in block-bindings, and add ExamplePageBlock definition for improved demo functionality. ([e8bf9358](../../commit/e8bf9358dfb762eb296e7c9612c33460e42ec612))
- Bump ngx-blocks-studio version to 0.0.14 and enhance BlockDefinitionsRegistry to support metadata storage for block definitions. Update registry-metadata to include block definition type and improve metadata handling in the registry. ([f5995c37](../../commit/f5995c3786b6dd80404de63b4dcc5d984a8cf997))
- Bump ngx-blocks-studio version to 0.0.12 and enhance output reference resolution. Introduce safe expression evaluation and improve parameter handling in output references for better dynamic content rendering. ([42164794](../../commit/42164794cf62167baa24b4d7c41577147ff502e8))
- Bump ngx-blocks-studio version to 0.0.11 and introduce block bindings functionality. Add block-bindings.ts for managing inputs and outputs, and refactor BlockLoaderService to utilize new binding methods for improved component interaction and signal handling. ([41a3153f](../../commit/41a3153f5391abc27fe8b830fa14ead0d6950ea8))
- Bump ngx-blocks-studio version to 0.0.8 and update BlockLoaderService to use ResolverContext for improved output handling and reference resolution. ([e66dc95e](../../commit/e66dc95e2d4e2d7a4517d766ce1c9cdc983c7f6d))
- Bump ngx-blocks-studio version to 0.0.7 and update README to reflect new project name and improved documentation structure. ([bc5d1ad0](../../commit/bc5d1ad0c1df8cf7e53aa29fc1bf77dc8e68f093))
- Bump ngx-blocks-studio version to 0.0.5 and update BlockLoaderService to use the view container's injector for improved component hierarchy management. ([368ddf07](../../commit/368ddf07cf59877dbdb33e87c57b318c09ab065a))
- Bump ngx-blocks-studio version to 0.0.4 and refactor BlockLoaderService to enhance service type resolution and streamline injector creation for improved block management. ([205bbb2d](../../commit/205bbb2d150aca993e781bdc3172cb58f841ac04))
- Bump ngx-blocks-studio version to 0.0.2 and update block reference documentation to use blockId instead of id. Refactor block-loader service and related schemas for improved clarity and consistency in block management. ([9f3a1ee0](../../commit/9f3a1ee0c20c6a08dec4235825e5ce132d971607))
- Update Angular dependencies to version 21.2.0 and enhance package scripts for building and publishing the library. Introduce a new script for publishing ngx-blocks-studio to npm with options for dry-run and tagging. ([272f8393](../../commit/272f8393ebb1c3fe3ed04745f9722da0f8a21175))

## Other

- Merge pull request #1 from winghei/staging ([2952e7f6](../../commit/2952e7f624b6f437791e85224f6ff5a67aa8410b))

  Merge staging into main
- Initial commit ([5fc8dbec](../../commit/5fc8dbec4d52cfc8582e849e94e3f9cfdbb8d778))

