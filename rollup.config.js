
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
// import alias from '@rollup/plugin-alias';
import replace from '@rollup/plugin-replace';

const nodeResolveOpt = {
    browser: false, // https://github.com/rollup/plugins/blob/master/packages/node-resolve/README.md#mainfields
    preferBuiltins: false, // url // https://github.com/pixijs/pixi.js/blob/dev/packages/utils/package.json // https://www.npmjs.com/package/url
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
                freeze: false,
                sourcemap: true,
            },
            {
                file: 'dist/divina.esm.js',
                format: 'es',
                compact: true,
                freeze: false,
                sourcemap: true,
            },
            {
                file: 'dist/divina.iife.js',
                format: 'iife',
                name: libName,
                freeze: false,
                sourcemap: true,
            }
        ],
        watch: true,
        watch: {
            include: 'src/**'
        },        
        plugins: [
            nodeResolve(nodeResolveOpt),
            commonjs(),
            // nodePolyfills(), // url // https://github.com/pixijs/pixi.js/blob/dev/packages/utils/package.json // https://www.npmjs.com/package/url
            // alias({
            //     entries: [
            //         {
            //             find: 'pixi.js-legacy',
            //             replacement: 'pixi.js',
            //         },
            //     ],
            // }),
        ],
        manualChunks: (id) => {
            console.log(id);
        },
    },
    {
        input: 'src/index.js',
        output: [
            {
                file: 'dist/divina.iife.min.js',
                format: 'iife',
                name: libName,
                plugins: [terser()],
                freeze: false,
                sourcemap: true,
            },
        ],
        watch: false,
        plugins: [
            nodeResolve(nodeResolveOpt),
            commonjs(),
            // alias({
            //     entries: [
            //         {
            //             find: 'pixi.js-legacy',
            //             replacement: 'pixi.js',
            //         },
            //     ],
            // }),
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
            // alias({
            //     entries: [
            //         {
            //             find: 'pixi.js-legacy',
            //             replacement: 'pixi.js',
            //         },
            //     ],
            // }),
            replace({
                // include: ['src/*'],
                delimiters: ['', ''], // otherwise, word boundaries!
                'pixi.js-legacy': 'pixi.js',
            }),
            nodeResolve(nodeResolveOpt),
            commonjs(),

        ],
        external: [
            'pixi.js',
            'hammerjs',
        ],
        watch: false,
    },
]