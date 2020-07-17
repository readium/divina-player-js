
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

const nodeResolveOpt = {
    browser: true,
    preferBuiltins: false,
    // pass custom options to the resolve plugin
    customResolveOptions: {
        moduleDirectory: 'node_modules'
    },
};

const libName = "divinaPlayer";

export default [
    {
        input: 'src/index.js',
        output: [
            {
                file: 'dist/divina.umd.js',
                format: 'umd',
                name: libName,
                compact: true,
                sourcemap: true,
            },
            {
                file: 'dist/divina.esm.js',
                format: 'es',
                compact: true,
                sourcemap: true,
            },
            {
                file: 'dist/divina.js',
                format: 'iife',
                name: libName,
                sourcemap: true,
            }
        ],
        watch: true,
        plugins: [
            nodeResolve(nodeResolveOpt),
            commonjs(),
            // nodePolyfills(), // url // https://github.com/pixijs/pixi.js/blob/dev/packages/utils/package.json // https://www.npmjs.com/package/url
        ],
    },
    {
        input: 'src/index.js',
        output: [
            {
                file: 'dist/divina.min.js',
                format: 'iife',
                name: libName,
                plugins: [terser()],
                sourcemap: true,
            },
        ],
        watch: false,
        plugins: [
            nodeResolve(nodeResolveOpt),
            commonjs(),
        ],
    },
    {
        input: 'src/index.js',
        output: [
            {
                file: 'lib/divina.cjs.js',
                format: 'cjs',
                sourcemap: true,
            },
            {
                file: 'lib/divina.esm.js',
                format: 'es',
                sourcemap: true,
            },
        ],
        plugins: [
            nodeResolve(nodeResolveOpt),
            commonjs(),
        ],
        external: [
            'pixi.js-legacy',
            'hammerjs',
        ],
        watch: true,
    },
]