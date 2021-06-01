import path from 'path';
import fs from 'fs';
import express from 'express';
import compression from 'compression';
import serveStatic from 'serve-static';
import consola from 'consola';
import events from './utils/events';
import doRender from './lib/doRender';

export default class Server {
  constructor(options) {
    this.options = options;
    this.app = express();

    this.devMiddleware = null;

    this.resources = {};

    if (options.dev) {
      events.on('devMiddleware', (m) => {
        this.devMiddleware = m;
      });
      events.on('resources', (mfs) => {
        this.loadResources(mfs);
      });
    }

    this.ready = this.ready.bind(this);
    this.setupMiddleware = this.setupMiddleware.bind(this);
    this.useMiddleware = this.useMiddleware.bind(this);
    this.loadResources = this.loadResources.bind(this);
    this.defineRoutes = this.defineRoutes.bind(this);
    this.listen = this.listen.bind(this);
  }

  on(name, cb) {
    return events.on(name, cb);
  }

  emit(name, ...args) {
    return events.emit(name, ...args);
  }

  loadResources(_fs) {
    const { options, defineRoutes } = this;
    const { dir, build } = options;

    let result = {};

    try {
      const fullPath = path.join(dir.root, dir.build, build.dir.manifest);

      if (!_fs.existsSync(fullPath)) return;

      const contents = _fs.readFileSync(fullPath, 'utf-8');

      result = JSON.parse(contents) || {};
    } catch (err) {
      consola.error('Unable to load resource:', err);
    }

    this.resources = result;

    defineRoutes(Object.keys(result));
  }

  defineRoutes(names = []) {
    const { resources, options, app, _definedRoute } = this;
    this._definedRoute = _definedRoute || {};

    names.forEach((name) => {
      if (this._definedRoute[name]) return;
      const routePath = name === '_error' ? '*' : `/${name
        .replace(new RegExp('/?index$'), '')
        .replace(/_/g, ':')}`;

      app.get(routePath, doRender({ name, resources, options }));
      this._definedRoute[name] = true;
    });
  }

  async ready() {
    const { _readyCalled, setupMiddleware, options, loadResources } = this;
    if (_readyCalled) return this;
    this._readyCalled = true;

    // Setup nuxt middleware
    await setupMiddleware();

    if (!options.dev) await loadResources(fs);

    return this;
  }

  setupMiddleware() {
    const { options, useMiddleware } = this;
    const { dev, server, build, dir } = options;
    const { compressor } = server || {};

    if (dev) {
      useMiddleware((req, res, next) => {
        const { devMiddleware } = this;
        if (!devMiddleware) return next();

        devMiddleware(req, res, next);
      });
    } else {
      // gzip
      if (typeof compressor === 'object') {
        // If only setting for `compression` are provided, require the module and insert
        useMiddleware(compression(compressor));
      } else if (compressor) {
        // Else, require own compression middleware if compressor is actually truthy
        useMiddleware(compressor);
      }

      if (!build.publicPath.startsWith('http')) {
        // static
        const staticMiddleware = serveStatic(path.join(dir.root, dir.build, build.dir.static));
        useMiddleware({ route: `/${build.dir.static}`, handle: staticMiddleware });
      }
    }
  }

  useMiddleware(middleware) {
    const { app } = this;

    if (typeof middleware === 'object') return app.use(middleware.route || '/', middleware.handle);

    return app.use(middleware);
  }

  listen() {
    const { options, app } = this;
    const { host, port } = options.server;

    app.listen(port, host);

    consola.ready({
      message: `Server listening on http://${host}:${port}`,
      badge: true,
    });
  }
}
