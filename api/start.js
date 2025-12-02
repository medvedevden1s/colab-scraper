const { exec, spawn } = require('child_process');
const { platform } = require('os');

console.log('🔍 Checking for processes on port 4000...');

// Function to kill process on port 4000
function killPort4000() {
  return new Promise((resolve, reject) => {
    const isWindows = platform() === 'win32';

    if (isWindows) {
      // Windows: Use netstat and taskkill
      exec('netstat -ano | findstr :4000', (error, stdout) => {
        if (error || !stdout) {
          console.log('✓ Port 4000 is free');
          resolve();
          return;
        }

        // Parse PID from netstat output
        const lines = stdout.trim().split('\n');
        const pids = new Set();

        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            pids.add(pid);
          }
        });

        if (pids.size === 0) {
          console.log('✓ Port 4000 is free');
          resolve();
          return;
        }

        console.log(`⚠ Found ${pids.size} process(es) using port 4000`);

        // Kill all processes
        const killPromises = Array.from(pids).map(pid => {
          return new Promise((res) => {
            console.log(`  Killing process ${pid}...`);
            exec(`taskkill /PID ${pid} /F`, (err, stdout, stderr) => {
              if (err) {
                console.log(`  ⚠ Could not kill process ${pid}`);
              } else {
                console.log(`  ✓ Killed process ${pid}`);
              }
              res();
            });
          });
        });

        Promise.all(killPromises).then(() => {
          // Wait a moment for ports to be released
          setTimeout(() => {
            console.log('✓ Port 4000 is now free');
            resolve();
          }, 1000);
        });
      });
    } else {
      // Mac/Linux: Use lsof and kill
      exec('lsof -ti:4000', (error, stdout) => {
        if (error || !stdout) {
          console.log('✓ Port 4000 is free');
          resolve();
          return;
        }

        const pids = stdout.trim().split('\n');
        console.log(`⚠ Found ${pids.length} process(es) using port 4000`);

        const killPromises = pids.map(pid => {
          return new Promise((res) => {
            console.log(`  Killing process ${pid}...`);
            exec(`kill -9 ${pid}`, (err) => {
              if (err) {
                console.log(`  ⚠ Could not kill process ${pid}`);
              } else {
                console.log(`  ✓ Killed process ${pid}`);
              }
              res();
            });
          });
        });

        Promise.all(killPromises).then(() => {
          setTimeout(() => {
            console.log('✓ Port 4000 is now free');
            resolve();
          }, 1000);
        });
      });
    }
  });
}

// Main execution
killPort4000()
  .then(() => {
    console.log('');
    console.log('🚀 Starting API server...');
    console.log('');

    // Start the server
    const server = spawn('node', ['server.js'], {
      stdio: 'inherit',
      shell: true
    });

    server.on('error', (error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n\nShutting down server...');
      server.kill('SIGINT');
      process.exit(0);
    });
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
