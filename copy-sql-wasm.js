// Script to copy sql.js files from node_modules to extension root
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, 'node_modules', 'sql.js', 'dist');
const targetDir = __dirname;

// Files to copy
const files = [
  { from: 'sql-wasm.js', to: 'sql.js' },
  { from: 'sql-wasm.wasm', to: 'sql-wasm.wasm' }
];

console.log('📦 Copying sql.js files...\n');

files.forEach(file => {
  const sourcePath = path.join(sourceDir, file.from);
  const targetPath = path.join(targetDir, file.to);

  try {
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`✓ Copied ${file.from} → ${file.to}`);
    } else {
      console.error(`✗ Source file not found: ${sourcePath}`);
    }
  } catch (error) {
    console.error(`✗ Error copying ${file.from}:`, error.message);
  }
});

console.log('\n✨ Setup complete!');
console.log('The extension is ready to load in Chrome.');
