import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { RouteLoader } from '../../projects/blocks-studio/src/lib/core/services/router-loader.service';
import { ComponentRegistry } from '../../projects/blocks-studio/src/lib/core/registry/component.registry';
import { GuardRegistry } from '../../projects/blocks-studio/src/lib/core/registry/guard.registry';

@Component({ standalone: true, template: '' })
class RoutePage {}

const guardFn = () => true;

describe('RouteLoader', () => {
  let loader: RouteLoader;
  let router: { resetConfig: ReturnType<typeof vi.fn> };
  let http: { get: ReturnType<typeof vi.fn> };
  let componentRegistry: ComponentRegistry;
  let guardRegistry: GuardRegistry;

  beforeEach(async () => {
    router = { resetConfig: vi.fn() };
    http = { get: vi.fn() };

    await TestBed.configureTestingModule({
      providers: [
        RouteLoader,
        { provide: Router, useValue: router },
        { provide: HttpClient, useValue: http },
      ],
    }).compileComponents();

    loader = TestBed.inject(RouteLoader);
    componentRegistry = ComponentRegistry.getInstance();
    guardRegistry = GuardRegistry.getInstance();
    componentRegistry.clear();
    guardRegistry.clear();
    componentRegistry.register('RoutePage', RoutePage);
    guardRegistry.register('auth', guardFn);
  });

  afterEach(() => {
    componentRegistry.clear();
    guardRegistry.clear();
  });

  it('routeConfig is empty before any load', () => {
    expect(loader.routeConfig()).toEqual([]);
  });

  it('loadRoutes sets config and resets router with redirects', async () => {
    await loader.loadRoutes({
      routes: [{ path: 'home', component: 'RoutePage', canActivate: ['auth'] }],
      defaultRedirect: 'home',
      catchAllRedirect: 'home',
    });

    expect(loader.routeConfig()).toHaveLength(1);
    expect(loader.configPath()).toBe('');
    expect(router.resetConfig).toHaveBeenCalled();
    const routes = router.resetConfig.mock.calls[0][0];
    expect(routes[0]).toMatchObject({ path: '', redirectTo: 'home' });
    expect(routes[routes.length - 1]).toMatchObject({ path: '**', redirectTo: 'home' });
  });

  it('loadRoutesFromUrl fetches and loads', async () => {
    http.get.mockReturnValue(
      of({
        routes: [{ path: 'x', component: 'RoutePage', title: 'T' }],
      }),
    );
    await loader.loadRoutesFromUrl('/routes.json');
    expect(loader.configPath()).toBe('/routes.json');
    expect(router.resetConfig).toHaveBeenCalled();
  });

  it('loadRoutesFromUrl throws on HTTP error', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    http.get.mockReturnValue(throwError(() => new Error('net')));
    await expect(loader.loadRoutesFromUrl('/bad')).rejects.toThrow();
    err.mockRestore();
  });

  it('warns on unknown guard', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await loader.loadRoutes({
      routes: [{ path: 'g', component: 'RoutePage', canActivate: ['missing'] }],
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unknown guard'));
    warn.mockRestore();
  });

  it('loadComponent throws when component key missing in config data path', async () => {
    const rl = TestBed.inject(RouteLoader);
    await rl.loadRoutes({
      routes: [{ path: 'empty', component: 'RoutePage' }],
    });
    const routes = router.resetConfig.mock.calls.at(-1)![0];
    const route = routes.find((r: { path: string }) => r.path === 'empty');
    expect(await route.loadComponent()).toBe(RoutePage);
  });

  it('loadComponent throws when component missing', async () => {
    await loader.loadRoutes({
      routes: [{ path: 'z', component: 'Missing' }],
    });
    const routes = router.resetConfig.mock.calls[0][0];
    await expect(routes[0].loadComponent()).rejects.toThrow('not registered');
  });

  it('nested children with default redirect only', async () => {
    await loader.loadRoutes({
      routes: [
        {
          path: 'parent',
          component: 'RoutePage',
          children: {
            routes: [{ path: 'child', component: 'RoutePage' }],
            defaultRedirect: 'child',
          },
        },
      ],
    });
    const parent = router.resetConfig.mock.calls.at(-1)![0][0];
    expect(parent.children?.[0]).toMatchObject({ path: '', redirectTo: 'child' });
  });

  it('nested children with catch-all redirect only', async () => {
    await loader.loadRoutes({
      routes: [
        {
          path: 'parent',
          component: 'RoutePage',
          children: {
            routes: [{ path: 'child', component: 'RoutePage' }],
            catchAllRedirect: 'child',
          },
        },
      ],
    });
    const parent = router.resetConfig.mock.calls.at(-1)![0][0];
    expect(parent.children?.at(-1)).toMatchObject({ path: '**', redirectTo: 'child' });
  });
});
