import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import { config as loadEnv } from "dotenv";
import { rymScrobbleBanner } from "./meta/rymScrobbleBanner.js";
import { getVersion } from "./meta/version.js";

loadEnv();

function envReplacements() {
  return replace({
    preventAssignment: true,
    extensions: [".ts", ".js"],
    values: {
      "process.env.LASTFM_API_KEY": JSON.stringify(process.env.LASTFM_API_KEY ?? ""),
      "process.env.LASTFM_API_SECRET": JSON.stringify(process.env.LASTFM_API_SECRET ?? "")
    }
  });
}

function userscriptBanner() {
  const banner = rymScrobbleBanner.replace("__buildDate__", getVersion());
  return {
    name: "userscript-banner",
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === "chunk") {
          file.code = `${banner}\n${file.code}`;
        }
      }
    }
  };
}

export default {
  input: "src/rymscrobble.ts",
  plugins: [
    envReplacements(),
    typescript({ tsconfig: "./tsconfig.json" })
  ],
  output: [
    {
      file: "dist/RYMscrobble.js",
      format: "cjs",
      plugins: [userscriptBanner()]
    },
    {
      file: "dist/RYMscrobble.min.js",
      format: "iife",
      plugins: [terser(), userscriptBanner()]
    }
  ]
};
