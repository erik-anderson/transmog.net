import { captureNativeScreenshots } from "./native-screenshots.mjs";

for (const argument of ["--app", "--native-executable"]) {
  const index = process.argv.indexOf(argument);
  if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith("--")) {
    throw new Error(
      "Usage: npm run screenshots -- --app APP_CHECKOUT --native-executable RELEASE_EXE [--python PYTHON] [--update-source | --verify]",
    );
  }
}
await captureNativeScreenshots();
