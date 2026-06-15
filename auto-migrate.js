const { spawn } = require('child_process');

const child = spawn('npx', ['prisma', 'migrate', 'dev', '--name', 'rename_appointment_status_to_booked'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

child.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);
  if (output.includes('Are you sure you want to create this migration?')) {
    child.stdin.write('y\n');
  }
  if (output.includes('Do you want to continue?')) {
    child.stdin.write('y\n');
  }
});

child.stderr.on('data', (data) => {
  console.error(data.toString());
});

child.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
});
