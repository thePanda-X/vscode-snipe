import { spawn } from 'child_process';

const child = spawn('opencode', ['run', '--agent', 'build', 'Give me a summary of the current project.'], {
    shell: true,
    cwd: process.cwd(),
    stdio: ['inherit', 'pipe', 'pipe'] // stdin from terminal, pipe stdout/stderr
});

console.log('Starting opencode process...');

child.stdout?.on('data', (data) => {
    process.stdout.write(data);
});

child.stderr?.on('data', (data) => {
    process.stderr.write(data);
});

child.on('close', (code) => {
    if (code === 0) {
        console.log('\n✓ Process completed successfully');
    } else {
        console.error(`\n✗ Process exited with code ${code}`);
    }
});

child.on('error', (error) => {
    console.error(`Failed to start process: ${error.message}`);
});