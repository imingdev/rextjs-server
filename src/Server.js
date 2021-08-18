import path from 'path';
import fs from 'fs';
import { match } from 'path-to-regexp';
import express from 'express';
import compression from 'compression';
import serveStatic from 'serve-static';
import consola from 'consola';
import Renderer from './lib/Renderer';

export default class Server {
  constructor(options) {
    this.options = options;
    this.app = express();

    this.devMiddleware = null;

    this.resources = {};

    this.routeStacks = [];

    this.renderer = new Renderer(this);

    this.ready = this.ready.bind(this);
    this.setupMiddleware = this.setupMiddleware.bind(this);
    this.useMiddleware = this.useMiddleware.bind(this);
    this.setBuilderInstance = this.setBuilderInstance.bind(this);
    this.getAssets = this.getAssets.bind(this);
    this.loadResources = this.loadResources.bind(this);
    this.getContext = this.getContext.bind(this);
    this.listen = this.listen.bind(this);
  }

  /**
   * 设置builder 实例
   * @param builder
   */
  async setBuilderInstance(builder) {
    const { loadResources } = this;

    if (builder) {
      if (builder.middleware) this.devMiddleware = builder.middleware;
      if (builder.mfs) await loadResources(builder.mfs);
    }
  }

  /**
   * load client resources
   * @param _fs fs|mfs
   * @returns Promise({{}})
   */
  loadResources(_fs) {
    const { options } = this;
    const { dir, build } = options;

    let result = {};

    try {
      const fullPath = path.join(dir.root, dir.build, build.dir.manifest);

      if (_fs.existsSync(fullPath)) {
        const contents = _fs.readFileSync(fullPath, 'utf-8');

        result = JSON.parse(contents) || {};
      }
    } catch (err) {
      result = {};
    }

    this.resources = result;
    this.routeStacks = Object.keys(result).map((name) => {
      let pathName;
      if (name === '_error') {
        pathName = '(.*)';
      } else {
        pathName = name.replace(new RegExp('/?index$'), '').replace(/_/g, ':');
        pathName = `/${pathName}`;
      }
      return ({
        match: match(pathName, { decode: decodeURIComponent, strict: true, end: true, sensitive: false }),
        entry: name,
      });
    });

    return Promise.resolve(result);
  }

  /**
   * get client assets
   * @param name  client manifest name
   * @returns {{styles: string[], scripts: string[]}}
   */
  getAssets(name) {
    const { resources } = this;

    const defaultResult = {
      styles: [],
      scripts: [],
    };

    const res = resources[name] || [];
    if (!res.length) return defaultResult;

    return {
      styles: res.filter((row) => /\.css$/.test(row)),
      scripts: res.filter((row) => /\.js$/.test(row) && !/\.hot-update.js$/.test(row)),
    };
  }

  getContext(context) {
    const contextHandle = this.options.server.getContext;

    if (typeof contextHandle === 'function') return contextHandle(context);

    return context;
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
    const { options, useMiddleware, renderer } = this;
    const { dev, server, build, dir } = options;
    const { compressor, middleware } = server || {};

    if (dev) {
      useMiddleware((req, res, next) => {
        const { devMiddleware } = this;
        if (devMiddleware) return devMiddleware(req, res, next);

        return next();
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
        useMiddleware({
          route: `/${build.dir.static}`,
          handle: staticMiddleware,
        });
      }
    }

    // Add user provided middleware
    (middleware || []).forEach(useMiddleware);

    // Finally use routerMiddleware
    useMiddleware(renderer.render);
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
