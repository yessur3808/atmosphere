module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["svelte3"],
  overrides: [
    {
      files: ["*.svelte"],
      processor: "svelte3/svelte3",
    },
    {
      files: ["*.cjs", "rollup.config.js", "server.cjs", "svelte.config.js"],
      env: { browser: false, node: true },
      parserOptions: { sourceType: "script" },
    },
    {
      files: ["tests/**/*.mjs", "scripts/**/*.mjs"],
      env: { browser: false, node: true },
    },
  ],
  ignorePatterns: ["node_modules/", "public/build/"],
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
  },
};
