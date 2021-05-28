import path from 'path';
import connect from 'connect';
import compression from 'compression';
import serveStatic from 'serve-static';
import consola from 'consola';
import events from './utils/events';
import rextMiddleware from './middleware/rext';

export default class Server {
  constructor(options) {
    this.options = options;
    this.app = connect();

    this.devMiddleware = null;

    if (options.dev) {
      events.on('devMiddleware', (m) => {
        this.devMiddleware = m;
      });
    }

    this.ready = this.ready.bind(this);
    this.setupMiddleware = this.setupMiddleware.bind(this);
    this.useMiddleware = this.useMiddleware.bind(this);
    this.listen = this.listen.bind(this);
  }

  on(name, cb) {
    return events.on(name, cb);
  }

  emit(name, ...args) {
    return events.emit(name, ...args);
  }

  async ready() {
    const { _readyCalled, setupMiddleware } = this;
    if (_readyCalled) return this;
    this._readyCalled = true;

    // Setup nuxt middleware
    await setupMiddleware();

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

    // Finally use router middleware
    useMiddleware(rextMiddleware(this));
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
