import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// snarkjs + @stellar/stellar-sdk need Node globals (Buffer/process) in the browser.
export default defineConfig({
  base: "./",
  plugins: [
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
  ],
});
