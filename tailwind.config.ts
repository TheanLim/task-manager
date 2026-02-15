import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			sans: ['var(--font-sans)', 'sans-serif'],
  			mono: ['var(--font-mono)', 'monospace'],
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			'priority-high': 'hsl(38 92% 50%)',
  			'priority-medium': 'hsl(38 92% 50% / 0.4)',
  			'priority-low': 'hsl(220 10% 55% / 0.2)',
  			'accent-brand': 'hsl(var(--accent-brand) / <alpha-value>)',
  			'accent-brand-hover': 'hsl(var(--accent-brand-hover) / <alpha-value>)',
  			'accent-brand-muted': 'hsl(var(--accent-brand-muted) / <alpha-value>)',
  			'destructive-hover': 'hsl(var(--destructive-hover) / <alpha-value>)',
  		},
  		boxShadow: {
  			'elevation-base': '0 1px 3px hsl(40 10% 50% / 0.04), 0 1px 2px hsl(40 10% 50% / 0.06)',
  			'elevation-raised': '0 4px 6px hsl(40 10% 50% / 0.06), 0 2px 4px hsl(40 10% 50% / 0.04)',
  			'elevation-overlay': '0 10px 15px hsl(40 10% 50% / 0.08), 0 4px 6px hsl(40 10% 50% / 0.04)',
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'check-pop': {
  				'0%': { transform: 'scale(1)' },
  				'50%': { transform: 'scale(1.5)' },
  				'100%': { transform: 'scale(1)' },
  			},
  			'fade-in-up': {
  				from: { opacity: '0', transform: 'translateY(8px)' },
  				to: { opacity: '1', transform: 'translateY(0)' },
  			},
  			'slide-in-right': {
  				from: { transform: 'translateX(100%)' },
  				to: { transform: 'translateX(0)' },
  			},
  			'slide-out-right': {
  				from: { transform: 'translateX(0)' },
  				to: { transform: 'translateX(100%)' },
  			},
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'check-pop': 'check-pop 0.3s ease-out',
  			'fade-in-up': 'fade-in-up 0.3s ease-out forwards',
  			'slide-in-right': 'slide-in-right 0.25s ease-out',
  			'slide-out-right': 'slide-out-right 0.2s ease-in',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
