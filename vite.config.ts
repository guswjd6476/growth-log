import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['apple-touch-icon.png', 'favicon.png'],
            workbox: { importScripts: ['push-sw.js'] },
            manifest: {
                name: '성장일지',
                short_name: '성장일지',
                description: '공부·독서·습관을 한곳에서 관리하는 자기계발 앱',
                lang: 'ko',
                display: 'standalone',
                start_url: '/',
                background_color: '#ffffff',
                theme_color: '#3182f6',
                icons: [
                    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
        }),
    ],
    test: { environment: 'node' },
});
