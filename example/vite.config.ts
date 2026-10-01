import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Alias `react-turnjs` to the library source so the demo imports
// exactly like a real user: `from 'react-turnjs'`.
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            'react-turnjs': path.resolve(rootDir, '../src/index.ts'),
        },
    },
});
