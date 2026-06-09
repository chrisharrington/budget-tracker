// Flat config (CommonJS — server/package.json has no "type": "module"). Combines the js + typescript-eslint
// recommended presets with the two type-aware rules called out in BTAPI-25 (no-floating-promises,
// require-await) and eslint-plugin-promise. eslint-config-prettier is applied last so it switches off any
// stylistic rules that would conflict with Prettier.
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const promise = require('eslint-plugin-promise');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = tseslint.config(
    {
        ignores: ['node_modules/**', '**/*.js', '**/*.js.map', 'bun.lock', 'mail/sample.txt', 'mail/__fixtures__/**']
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    promise.configs['flat/recommended'],
    {
        languageOptions: {
            globals: {
                ...globals.node
            }
        }
    },
    {
        // Type-aware rules (no-floating-promises needs type info) run on source files only. The test files are
        // named `.test.ts` and live outside the tsconfig project (its include globs skip dotfiles), so scoping
        // the project service here keeps those rules on the real source while avoiding "file not found by the
        // project service" parse errors on the tests. The tests are still lint-checked syntactically above.
        files: ['**/*.ts', '**/*.tsx'],
        ignores: ['**/.test.ts', '**/.test.tsx'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: __dirname
            }
        },
        rules: {
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/require-await': 'error'
        }
    },
    {
        // Honour the leading-underscore convention this codebase already uses for deliberately-unused
        // parameters and bindings (e.g. an Express error handler's `_next`, mock signatures).
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    // Allow `const { omitted, ...rest } = obj` — a common way to build a value without a field.
                    ignoreRestSiblings: true
                }
            ]
        }
    },
    prettier
);
