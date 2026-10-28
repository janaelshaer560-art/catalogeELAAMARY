const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const output = path.join(root, 'dist');
const apiKey = process.env.GOOGLE_DRIVE_API_KEY;

if (!apiKey) {
  throw new Error('Set GOOGLE_DRIVE_API_KEY in the Vercel project environment variables.');
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of ['index.html', 'scripts.js', 'styles.css']) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}

fs.cpSync(path.join(root, 'elaamaryph'), path.join(output, 'elaamaryph'), {
  recursive: true
});

const driveConfig = {
  apiKey,
  rootFolderId: '1NEJtg_yYAgdpQGcBr6Ql0YlRo3VyOK66'
};

fs.writeFileSync(
  path.join(output, 'drive-config.js'),
  `window.CATALOG_DRIVE_CONFIG = ${JSON.stringify(driveConfig, null, 2)};\n`
);
