/**
 * Use Vite's built-in watch mode for better performance and reliability
 */

import { build as viteBuild, loadConfigFromFile } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

console.log('\n📦 Starting Vite build with watch mode...\n');

try {
    const { config } = await loadConfigFromFile(
        { command: 'build', mode: 'development' },
        resolve(__dirname, 'vite.config.ts')
    );

    const watchConfig = {
        ...config,
        mode: 'development',
        build: {
            ...config.build,
            watch: {
                exclude: ['node_modules/**', 'assets/**'],
            },
        },
        plugins: [
            ...(config.plugins || []),
            {
                name: 'watch-progress',
                buildStart() {
                    console.log('👀 Watching for changes...\n');
                },
                buildEnd() {
                    console.log('✅ Build complete\n');
                },
            },
        ],
    };

    await viteBuild(watchConfig);
} catch (e) {
    console.error('❌ Build failed:', e.message);
    process.exit(1);
}

process.on('SIGINT', () => {
    console.clear();
    console.log('\n👋 Stopped watching for changes\n');
    process.exit(0);
});
