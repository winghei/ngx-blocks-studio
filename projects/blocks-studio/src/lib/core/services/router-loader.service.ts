import { Router, Routes, RunGuardsAndResolvers } from '@angular/router';
import { Type, Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ComponentRegistry } from '../registry/component.registry';
import { GuardRegistry, type GuardOrType } from '../registry/guard.registry';

/**
 * Route configuration for the router.
 * @param path - The path of the route.
 * @param component - The component key to load for the route using the ComponentRegistry.
 * @param title - The title of the route.
 * @param canActivate - The guards keys to activate for the route using the GuardRegistry.
 * @param canDeactivate - The guards keys to deactivate for the route using the GuardRegistry.
 * @param canLoad - The guards keys to load for the route using the GuardRegistry.
 * @param canMatch - The guards keys to match for the route using the GuardRegistry.
 * @param pathMatch - The path match strategy for the route.
 * @param outlet - The outlet of the route.
 * @param canActivateChild - The guards keys to activate the children routes for the route using the GuardRegistry.
 * @param runGuardsAndResolvers - The strategy to run guards and resolvers for the route.
 * @param data - The data to pass to the route. It will be merged with the data from the route config file.
 * @param children - Nested routes and optional defaultRedirect/catchAllRedirect for the child segment.
 */

export interface RouteConfig {
  path: string;
  component: string;
  title?: string;
  canActivate?: string[];
  canDeactivate?: string[];
  canLoad?: string[];
  canMatch?: string[];
  outlet?: string;
  pathMatch?: 'full' | 'prefix';
  canActivateChild?: string[];
  runGuardsAndResolvers?: RunGuardsAndResolvers;
  data?: Record<string, any>;
  /** Child routes; can include defaultRedirect and catchAllRedirect for this segment. */
  children?: RouteConfigs;
}

export interface RouteConfigs {
  routes: RouteConfig[];
  /** Redirect path for empty route (path: ''). Omit to not add a default redirect. */
  defaultRedirect?: string;
  /** Redirect path for unknown routes (path: '**'). Omit to not add a catch-all. */
  catchAllRedirect?: string;
}

@Injectable({
  providedIn: 'root',
})
export class RouteLoader {
  private router = inject(Router);
  private http = inject(HttpClient);
  private componentRegistry = ComponentRegistry.getInstance();
  private guardRegistry = GuardRegistry.getInstance();

  private readonly _routeConfigFile = signal<RouteConfigs | null>(null);
  private readonly _configPath = signal<string>('');

  /** Currently loaded route config file, or null if not yet loaded. */
  readonly routeConfigFile = this._routeConfigFile.asReadonly();
  /** Path from which the config was loaded. */
  readonly configPath = this._configPath.asReadonly();
  /** Route config array from the loaded file. */
  readonly routeConfig = computed<RouteConfig[]>(() => this._routeConfigFile()?.routes ?? []);

  /**
   * Load routes from a config object. Updates signals and resets the router.
   */
  async loadRoutes(config: RouteConfigs): Promise<void> {
    this._configPath.set('');
    this._routeConfigFile.set(config);

    await this.updateRoutes();
  }

  /**
   * Fetch route config from a URL (HTTP GET), then load it. Sets configPath signal to the requested URL.
   */
  async loadRoutesFromUrl(configPath: string): Promise<void> {
    try {
      const config = await firstValueFrom(this.http.get<RouteConfigs>(configPath));
      this._configPath.set(configPath);
      this._routeConfigFile.set(config);
      await this.updateRoutes();
    } catch (error) {
      console.error('Failed to load route configuration from URL:', error);
      throw error;
    }
  }

  private async updateRoutes(): Promise<void> {
    const config = this._routeConfigFile();
    const routeConfigList = this.routeConfig();
    const routes: Routes = await Promise.all(
      routeConfigList.map((routeConfig) => this.convertRouteConfig(routeConfig))
    );

    if (config?.defaultRedirect != null && config.defaultRedirect !== '') {
      routes.unshift({
        path: '',
        redirectTo: config.defaultRedirect,
        pathMatch: 'full',
      });
    }

    if (config?.catchAllRedirect != null && config.catchAllRedirect !== '') {
      routes.push({
        path: '**',
        redirectTo: config.catchAllRedirect,
      });
    }

    this.router.resetConfig(routes);
  }

  private async convertRouteConfig(config: RouteConfig): Promise<Routes[0]> {
    const routeData: Record<string, unknown> = { ...(config.data ?? {}) };
    if (config.component) {
      routeData['component'] = config.component;
    }

    const [
      canActivateGuards,
      canDeactivateGuards,
      canLoadGuards,
      canMatchGuards,
      canActivateChildGuards,
    ] = await Promise.all([
      this.resolveGuards(config.canActivate),
      this.resolveGuards(config.canDeactivate),
      this.resolveGuards(config.canLoad),
      this.resolveGuards(config.canMatch),
      this.resolveGuards(config.canActivateChild),
    ]);

    const route: Routes[0] = {
      path: config.path,
      loadComponent: () => this.loadComponent(config),
      data: routeData,
      ...(config.title != null && { title: config.title }),
      ...(config.outlet != null && { outlet: config.outlet }),
      ...(config.pathMatch != null && { pathMatch: config.pathMatch }),
      ...(config.runGuardsAndResolvers != null && {
        runGuardsAndResolvers: config.runGuardsAndResolvers,
      }),
      ...(canActivateGuards.length > 0 && {
        canActivate: canActivateGuards as Routes[0]['canActivate'],
      }),
      ...(canDeactivateGuards.length > 0 && {
        canDeactivate: canDeactivateGuards as Routes[0]['canDeactivate'],
      }),
      ...(canLoadGuards.length > 0 && { canLoad: canLoadGuards as Routes[0]['canLoad'] }),
      ...(canMatchGuards.length > 0 && { canMatch: canMatchGuards as Routes[0]['canMatch'] }),
      ...(canActivateChildGuards.length > 0 && {
        canActivateChild: canActivateChildGuards as Routes[0]['canActivateChild'],
      }),
    };

    if (config.children?.routes?.length) {
      const childConfigs = config.children;
      route.children = await Promise.all(
        childConfigs.routes.map((child) => this.convertRouteConfig(child))
      );
      if (childConfigs.defaultRedirect != null && childConfigs.defaultRedirect !== '') {
        route.children.unshift({
          path: '',
          redirectTo: childConfigs.defaultRedirect,
          pathMatch: 'full',
        });
      }
      if (childConfigs.catchAllRedirect != null && childConfigs.catchAllRedirect !== '') {
        route.children.push({
          path: '**',
          redirectTo: childConfigs.catchAllRedirect,
        });
      }
    }

    return route;
  }

  private async resolveGuards(guardNames: string[] | undefined): Promise<GuardOrType[]> {
    if (!guardNames?.length) return [];
    const resolved = await Promise.all(guardNames.map((name) => this.getGuard(name)));
    return resolved.filter((g): g is GuardOrType => g != null);
  }

  private async loadComponent(routeConfig: RouteConfig): Promise<Type<unknown>> {
    const componentName = routeConfig.component;
    if (!componentName) {
      throw new Error('Route config must specify a component key.');
    }
    const component = await this.componentRegistry.get(componentName);
    if (!component) {
      throw new Error(
        `Component "${componentName}" is not registered. Register it with ComponentRegistry before loading routes.`
      );
    }
    return component;
  }

  private async getGuard(guardName: string): Promise<GuardOrType | null> {
    const guard = await this.guardRegistry.get(guardName);
    if (guard == null) {
      console.warn(`Unknown guard: ${guardName}. Register it with GuardRegistry.`);
      return null;
    }
    return guard;
  }
}
