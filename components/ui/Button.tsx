import React from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'success' | 'error'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: React.ReactNode
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--text-primary)',
    color: 'var(--canvas)',
    border: 'none',
    borderRadius: 2,
  },
  secondary: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-standard)',
    borderRadius: 2,
  },
  tertiary: {
    background: 'transparent',
    color: 'var(--text-tertiary)',
    border: 'none',
    borderRadius: 2,
    paddingLeft: 0,
    paddingRight: 0,
  },
  destructive: {
    background: 'rgba(204,68,68,0.1)',
    color: 'var(--accent-red)',
    border: '1px solid rgba(204,68,68,0.3)',
    borderRadius: 2,
  },
  success: {
    background: 'transparent',
    color: 'var(--accent-green)',
    border: '1px solid var(--accent-green)',
    borderRadius: 2,
  },
  error: {
    background: 'transparent',
    color: 'var(--accent-red)',
    border: '1px solid rgba(204,68,68,0.4)',
    borderRadius: 2,
  },
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-5 py-2 text-xs tracking-[0.2em] uppercase',
  md: 'px-7 py-2.5 text-sm font-medium tracking-[0.2em] uppercase',
  lg: 'px-10 py-3 text-sm font-medium tracking-[0.2em] uppercase',
}

const hoverStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: '#fff' },
  secondary: { borderColor: 'var(--border-emphasis)', color: 'var(--text-primary)' },
  tertiary: { color: 'var(--text-secondary)' },
  destructive: { background: 'rgba(204,68,68,0.2)', borderColor: 'rgba(204,68,68,0.5)' },
  success: { background: 'rgba(90,138,90,0.1)' },
  error: { background: 'rgba(204,68,68,0.1)', borderColor: 'rgba(204,68,68,0.6)' },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  style,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] ${sizeStyles[size]} ${className}`}
      style={{ ...variantStyles[variant], ...style }}
      disabled={disabled}
      onMouseEnter={e => {
        if (disabled) return
        Object.assign(e.currentTarget.style, hoverStyles[variant])
      }}
      onMouseLeave={e => {
        Object.assign(e.currentTarget.style, variantStyles[variant])
      }}
      {...props}
    >
      {children}
    </button>
  )
}
