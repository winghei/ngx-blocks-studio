# BlocksStudio

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.0.

Angular library for config-driven routing and registries. See the [documentation](../../docs/README.md) for full API and usage.

## Route loader

**RouteLoader** loads route configuration from a JSON URL, resolves components and guards by name via **ComponentRegistry** and **GuardRegistry**, and applies the resulting `Routes` to the router. Config is exposed as signals (`routeConfigFile`, `configPath`, `routeConfig`).

- **RouteConfig** – `path`, `component` (registry key), optional `title`, guard keys (`canActivate`, etc.), `data`, and `children` (`RouteConfigs`: routes + optional `defaultRedirect` / `catchAllRedirect`).
- **RouteConfigs** – `routes: RouteConfig[]`, optional `defaultRedirect` and `catchAllRedirect` (used at top-level and for each route’s `children`).

Register all component and guard keys before loading. Use `loadRoutes(config)` for in-memory config or `loadRoutesFromUrl(url)` to fetch from a URL. Full details: [Route loader docs](../../docs/core/router-loader.md).

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the library, run:

```bash
ng build blocks-studio
```

This command will compile your project, and the build artifacts will be placed in the `dist/` directory.

### Publishing the Library

Once the project is built, you can publish your library by following these steps:

1. Navigate to the `dist` directory:
   ```bash
   cd dist/blocks-studio
   ```

2. Run the `npm publish` command to publish your library to the npm registry:
   ```bash
   npm publish
   ```

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
