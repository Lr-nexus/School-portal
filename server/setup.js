const { execSync } = require('child_process');
const path = require('path');

function run(script) {
  console.log(`\n─────────── Running ${script} ───────────\n`);
  execSync(`node ${path.join(__dirname, script)}`, { stdio: 'inherit' });
}

try {
  run('init.js');
  run('seed.js');
  console.log('\n🎉 Setup complete. Run `npm run dev` to start the server.\n');
} catch (err) {
  console.error('\n❌ Setup failed. See the errors above.\n');
  process.exit(1);
}