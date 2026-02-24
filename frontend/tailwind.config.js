/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        chat: {
          // WhatsApp-like colors
          bg: '#111b21',
          panel: '#202c33',
          panelHover: '#2a3942',
          bubbleOut: '#005c4b',
          bubbleIn: '#202c33',
          bubbleInLight: '#333e47',
          accent: '#25d366',
          accentDark: '#128c7e',
          border: '#333e47',
          borderLight: '#3b4a54',
          muted: '#8696a0',
          text: '#e9edef',
          textSecondary: '#8696a0',
          header: '#202c33',
          input: '#2a3942',
          // Original accent (for purple highlights)
          primary: '#6366f1',
        },
      },
    },
  },
  plugins: [],
};
