import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Helmet } from 'react-helmet';
import lodash from 'lodash';
import getContext from '../utils/context';

export default ({ name, resources, options }) => {
  const { dev, dir, build, globals } = options;
  const assets = resources[name];

  const resolve = (...p) => path.join(dir.root, ...p);

  // 加载react组件
  const requireReactComponent = (_path) => {
    const fullPath = resolve(dir.build, build.dir.server, _path);
    const { default: Component, getServerSideProps } = require(fullPath);
    if (dev) delete require.cache[fullPath];

    return { Component, getServerSideProps };
  };

  // 创建react元素
  const createReactElement = (component, opt) => React.createElement(component, opt);

  // 将react组件str
  const renderReactToString = (component, opt) => ReactDOMServer.renderToString(createReactElement(component, opt));

  // 将react组件渲染
  const renderReactToStaticMarkup = (component, opt) => ReactDOMServer.renderToStaticMarkup(createReactElement(component, opt));

  return async (req, res, next) => {
    // Get context
    const context = getContext(req, res);

    // Document
    const { Component: Document } = requireReactComponent('_document.js');
    // App
    const { Component: App, getServerSideProps: getAppServerSideProps } = requireReactComponent('_app.js');
    // Component
    const { Component, getServerSideProps } = requireReactComponent(`${name}.js`);

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
        pageScripts: assets.filter((row) => /\.js$/.test(row)),
        pageStyles: assets.filter((row) => /\.css$/.test(row)),
        state,
        helmet,
        context: globals.context,
        id: globals.id,
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
  };
};
