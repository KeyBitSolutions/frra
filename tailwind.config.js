/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './**/*.liquid',
        './src/**/*.{js,ts,css}',
        './sections/**/*.liquid',
        './snippets/**/*.liquid',
        './layout/**/*.liquid',
        './templates/**/*.liquid',
    ],
    theme: {
        extend: {
            screens: {
                xl: '1280px',
                '2xl': '1440px',
                '3xl': '1536px',
                '4xl': '1920px',
                '5xl': '2560px',
            },
            colors: {
                surface: {
                    50: '#FFFFFF',
                    100: '#F3F4F5',
                    200: '#CED4D7',
                    300: '#B0BAC0',
                    400: '#6B7E88',
                    500: '#092839',
                },
                brand: {
                    50: '#D1CCC4',
                    100: '#EBB58C',
                    200: '#BF8B66',
                    300: '#F8F3ED',
                    500: '#E8E2D9',
                },
                background: 'var(--color-background)',
                primary: 'var(--color-primary)',
                secondary: 'var(--color-secondary)',
                'primary-background': 'var(--color-primary-background)',
                'primary-foreground': 'var(--color-primary-foreground)',
                'secondary-background': 'var(--color-secondary-background)',
                'secondary-foreground': 'var(--color-secondary-foreground)',
            },
            fontFamily: {
                poppins: ['Poppins', 'sans-serif'],
            },
            fontWeight: {
                light: 300,
                regular: 400,
                bold: 700,
            },
            lineHeight: {
                3: '1.3',
                tight: '1.3',
            },
            letterSpacing: {
                1: '0.01em',
                2: '0.02em',
            },
            aspectRatio: {
                '4/3': '4 / 3',
            },
            spacing: {
                section: '3rem', // 51.2px
                'header-height': 'var(--header-height)', // Dynamisch
            },
            width: {
                full: '100%',
            },
            borderRadius: {
                sm: '0.25rem',
                lg: '0.5rem',
                '3xl': '1.25rem',
            },
            borderWidth: {
                1: '0.063',
            },
            zIndex: {
                90: '90',
            },
            wordBreak: {
                auto: 'auto',
            },
        },
    },
    plugins: [
        /* Base */
        // require('./src/assets/tailwind/base/typography'),

        /* Layout */
        // require('./src/assets/tailwind/base/layout'),

        /* Components */
        /* Utilities */
    ],
};
