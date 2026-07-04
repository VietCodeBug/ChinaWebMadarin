/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "var(--primary)",
        "primary-container": "var(--primary-container)",
        "primary-light": "var(--primary-light)",
        "surface": "var(--bg-app)",
        "background": "var(--bg-app)",
        "on-surface": "var(--text-main)",
        "on-background": "var(--text-main)",
        "outline-variant": "var(--card-border)",
        "surface-container-lowest": "var(--card-bg)",
        "surface-container-low": "var(--sidebar-bg)",
        "surface-container-high": "var(--card-bg-hover)",
        "surface-container": "var(--card-bg)",
        "secondary": "var(--text-muted)",
        "on-surface-variant": "var(--text-muted)",
        "on-primary": "var(--on-primary-text)",
        "error": "var(--error-color)",
        "error-text": "var(--error-text)",
        "error-bg": "var(--error-bg)",
        "success": "var(--success-color)",
        "success-text": "var(--success-text)",
        "success-bg": "var(--success-bg)",
        "warning": "var(--warning-color)",
        "warning-light": "var(--warning-light)"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      spacing: {
        "grid-gutter": "16px",
        "breakpoint-md": "768px",
        "stack-gap": "16px",
        "unit": "4px",
        "container-padding": "24px"
      },
    },
  },
  plugins: [],
};
