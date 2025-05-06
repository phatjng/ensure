import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/ensure.ts"],
  format: ["cjs", "esm"],
  platform: "neutral",
});
