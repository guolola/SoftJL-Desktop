// Downloads and verifies a Windows JRE for packaging; no vendor runtime is committed to source control.
import {
  access,
  mkdir,
  readFile,
  writeFile,
  readdir,
  rename,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
const root = fileURLToPath(new URL("../.runtime/", import.meta.url));
try {
  await access(join(root, "java/bin/java.exe"));
  console.log("Bundled Java runtime ready");
  process.exit(0);
} catch {}
await mkdir(root, { recursive: true });
const response = await fetch(
  "https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse",
);
if (!response.ok)
  throw new Error("Cannot resolve Windows JRE: " + response.status);
const assets = await response.json(),
  asset = assets[0]?.binary?.package;
if (
  !asset ||
  !asset.link.startsWith(
    "https://github.com/adoptium/temurin17-binaries/releases/download/",
  )
)
  throw new Error("Unexpected JRE source");
const archive = join(root, asset.name);
let bytes;
try {
  bytes = await readFile(archive);
} catch {
  const download = await fetch(asset.link);
  if (!download.ok) throw new Error("JRE download failed");
  bytes = Buffer.from(await download.arrayBuffer());
  await writeFile(archive, bytes);
}
if (createHash("sha256").update(bytes).digest("hex") !== asset.checksum)
  throw new Error("JRE checksum mismatch");
const stage = join(root, "java-unpack-" + Date.now());
execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "Expand-Archive -LiteralPath $env:SOFTJL_JRE_ARCHIVE -DestinationPath $env:SOFTJL_JRE_STAGE",
  ],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      SOFTJL_JRE_ARCHIVE: archive,
      SOFTJL_JRE_STAGE: stage,
    },
  },
);
const directories = await readdir(stage, { withFileTypes: true }),
  directory = directories.find((item) => item.isDirectory());
if (!directory) throw new Error("Invalid JRE archive");
await rename(join(stage, directory.name), join(root, "java"));
await writeFile(
  join(root, "java/source.json"),
  JSON.stringify(
    { name: asset.name, sha256: asset.checksum, url: asset.link },
    null,
    2,
  ),
);
console.log("Verified Windows JRE prepared for the installer");
