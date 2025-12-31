import { formatDateNow } from './datetime';

const result = await Bun.build({
  entrypoints: ["./index.html"],
  // minify: true,
  target: "browser",
});

if (!result.success) {
  console.error("Build failed");
  for (const message of result.logs) {
    console.error(message);
  }
  process.exit(1);
}

let assets: { [ ext: string ]: string[] | undefined } = {};

for (const output of result.outputs) {
  const ext = output.path.split('.').at(-1);
  if (ext) {
    const assetsExt = assets[ext] ?? [];
    assetsExt.push(await output.text());
    assets[ext] = assetsExt;
  }
}

// Doesn't work in Bun.build yet
if (!assets.css) {
  assets.css = [ await Bun.file('./styles.css').text() ];
}

const html = `<!DOCTYPE html>
<!--
  Built at ${formatDateNow('YYYYMMDD HH mm')}
  from https://github.com/nic11/ginger/tree/...
  by job
-->
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ginger</title>
    ${(assets.css ?? []).map((src) => `<style>${src}</style>`)}
</head>
<body>
    <div id="app"></div>
    ${(assets.js ?? []).map((src) => `<script>${src}</script>`)}
</body>
</html>
`;
const extra = `
<!--
Orig output:
${JSON.stringify({ ...assets, js: 'removed to save space' }, null, 2).replaceAll('<!', '\\u003C!').replaceAll('-->', '--\\u003E')}

HTML:
${assets.html?.at(0)?.replaceAll('<!', '\\u003C!').replaceAll('-->', '--\\u003E')}
-->
`;

await Bun.write("./dist/ginger.html", html);

export {};
