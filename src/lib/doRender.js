import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Helmet } from 'react-helmet';

export default ({ name, resources, options }) => {
  const resolve = (...dir) => path.join(dir.root, ...dir);
  // 加载react组件
  const requireReactComponent = (_path) => {
    const { dir, build } = options;
    const { default: Component, getServerSideProps } = require(resolve(dir.build, build.dir.server, _path));

    return { Component, getServerSideProps };
  };

  const assets = resources[name];
  const { Component: Document } = requireReactComponent('_document.js');
  const { Component: App, getServerSideProps: getAppServerSideProps } = requireReactComponent('_app.js');
  const { Component, getServerSideProps } = requireReactComponent(`${name}.js`);
  const globalContextName = options.globals.context;
  const globalIdName = options.globals.context;

  // 创建react元素
  const createReactElement = (component, opt) => React.createElement(component, opt);

  // 将react组件str
  const renderReactToString = (component, opt) => ReactDOMServer.renderToString(createReactElement(component, opt));

  // 将react组件渲染
  const renderReactToStaticMarkup = (component, opt) => ReactDOMServer.renderToStaticMarkup(createReactElement(component, opt));

  return async (req, res, next) => {
    const context = { req, res };
    let state;
    if (getAppServerSideProps && typeof getAppServerSideProps === 'function') {
      state = await getAppServerSideProps(context);
    }
    if (getServerSideProps && typeof getServerSideProps === 'function') {
      const pageState = await getServerSideProps(context);
      if (state || pageState) {
        state = { ...state || {}, ...pageState || {} };
      } else {
        state = pageState;
      }
    }

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
      context: globalContextName,
      id: globalIdName,
    });

    res.end(`<!doctype html>${content}`, 'utf8');

    next();
  };
};
