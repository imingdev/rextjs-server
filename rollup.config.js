import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import eslint from '@rollup/plugin-eslint';
import { dependencies } from './package.json';

export default {
  input: './src/Server.js',
  output: {
    file: 'dist/Server.js',
    format: 'cjs',
    exports: 'auto',
  },
  plugins: [
    // 支持第三方模块
    resolve(),
    // 支持 commonjs 格式
    commonjs(),
    // babel
    babel({ babelHelpers: 'inline' }),
    // eslint
    eslint(path.join(__dirname, '.eslintrc.js')),
  ],
  // 第三方模块不会强行打包到输出中
  external: Object.keys(dependencies).concat(['react', 'react-dom/server']),
};
