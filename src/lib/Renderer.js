import path from 'path';
import React from 'react';
import parseUrl from 'parseurl';
import ReactDOMServer from 'react-dom/server';
import { Helmet } from 'react-helmet';
import lodash from 'lodash';
import qs from 'qs';

const queryParse = qs.parse;

export default class Renderer {
  constructor(server) {
    this.server = server;
    this.options = server.options;

    this.cache = {};

    this.getAssets = server.getAssets.bind(server);
    this.getContext = server.getContext.bind(server);

    this.getCurrentRoute = this.getCurrentRoute.bind(this);
    this.resolve = this.resolve.bind(this);
    this.requireReactComponent = this.requireReactComponent.bind(this);
    this.createReactElement = this.createReactElement.bind(this);
    this.renderReactToString = this.renderReactToString.bind(this);
    this.renderReactToStaticMarkup = this.renderReactToStaticMarkup.bind(this);
    this.render = this.render.bind(this);
  }

  getCurrentRoute(req) {
    const routes = this.server.routeStacks;
    const { pathname, query } = parseUrl(req);

    for (let i = 0, { length } = routes; i < length; i += 1) {
      const { match, entry } = routes[i];
      const result = match(pathname);
      if (result) {
        const params = {};
        Object.keys(result.params).forEach((name) => {
          params[name] = result.params[name];
        });
        return {
          params,
          query: queryParse(query) || {},
          entry,
        };
      }
    }

    return {
      params: {},
      query: {},
      entry: '_error',
    };
  }

  resolve(...p) {
    return path.join.apply(path, [this.options.dir.root].concat(p));
  }

  // 加载react组件
  requireReactComponent(_path) {
    const { options, resolve, cache } = this;
    const { dev, dir, build } = options;
    const fullPath = resolve(dir.build, build.dir.server, _path);

    let component = cache[fullPath] || require(fullPath);
    if (!component) {
      component = require(fullPath);
      if (!dev) this.cache[fullPath] = component;
    }

    const { default: Component, getServerSideProps } = component;
    if (dev) delete require.cache[fullPath];

    return { Component, getServerSideProps };
  }

  // 创建react元素
  createReactElement(component, opt) {
    return React.createElement(component, opt);
  }

  // 将react组件str
  renderReactToString(component, opt) {
    return ReactDOMServer.renderToString(this.createReactElement(component, opt));
  }

  // 将react组件渲染
  renderReactToStaticMarkup(component, opt) {
    return ReactDOMServer.renderToStaticMarkup(this.createReactElement(component, opt));
  }

  async render(req, res, next) {
    const {
      options,
      getCurrentRoute,
      getContext,
      getAssets,
      requireReactComponent,
      renderReactToString,
      renderReactToStaticMarkup,
    } = this;
    const { entry, params, query } = getCurrentRoute(req);

    // Get assets
    const { scripts: pageScripts, styles: pageStyles } = getAssets(entry);

    // Get context
    const context = getContext({ req: { ...req, params, query }, params, query, res });

    // Document
    const { Component: Document } = requireReactComponent('_document.js');
    // App
    const { Component: App, getServerSideProps: getAppServerSideProps } = requireReactComponent('_app.js');
    // Component
    const { Component, getServerSideProps } = requireReactComponent(`${entry}.js`);

    try {
      let state;
      let appState;
      let pageState;

      // App
      if (lodash.isFunction(getAppServerSideProps)) appState = await getAppServerSideProps(context);

      // page
      if (lodash.isFunction(getServerSideProps)) pageState = await getServerSideProps(context);

      // deep state
      if (appState || pageState) state = lodash.defaultsDeep({}, appState || {}, pageState || {});

      // body
      const body = renderReactToString(App, {
        pageProps: state,
        Component,
      });

      // helmet
      const helmet = Helmet.renderStatic();

      // document(body, pageScripts, pageStyles, state, helmet, context, id)
      const content = renderReactToStaticMarkup(Document, {
        body,
        pageScripts,
        pageStyles,
        state,
        helmet,
        context: options.globals.context,
        id: options.globals.id,
      });

      const html = `<!doctype html>${content}`;
      // Send response
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Accept-Ranges', 'none');
      res.setHeader('Content-Length', Buffer.byteLength(html));

      res.end(html, 'utf8');
    } catch (err) {
      if (err.name === 'URIError') {
        err.statusCode = 400;
      }
      next(err);
    }
  }
}
