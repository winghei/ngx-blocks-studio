import CSSRuntime from '@master/css-runtime';
import type { MasterCSSManifest } from '@master/css';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppShellComponent } from './app/blocks/shell/app-shell.component';
import masterCssManifestJson from './master-css.manifest.json';

const masterCssManifest = masterCssManifestJson as MasterCSSManifest;

CSSRuntime.create({ manifest: masterCssManifest }).observe();

bootstrapApplication(AppShellComponent, appConfig).catch((err) =>
  console.error(err)
);
