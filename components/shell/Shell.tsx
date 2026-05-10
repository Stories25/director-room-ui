'use client'

import { useRouter } from 'next/navigation'

interface BreadcrumbStep {
  label: string
  href?: string
  current?: boolean
}

interface ShellProps {
  children: React.ReactNode
  breadcrumb?: BreadcrumbStep[]
  rightAction?: React.ReactNode
  fullHeight?: boolean
  noSprocket?: boolean
}

const MAX_W = 1080
const SPROCKET_OFFSET = 56

function SprocketEdge() {
  return (
    <div
      className="fixed left-0 top-0 bottom-0 z-40 pointer-events-none"
      style={{ width: SPROCKET_OFFSET }}
    >
      {/* Vertical line */}
      <div
        className="absolute left-6 top-0 bottom-0"
        style={{ width: 1, background: 'var(--border-subtle)' }}
      />
      {/* Sprocket holes — periodic dots */}
      {Array.from({ length: 20 }, (_, i) => (
        <div
          key={i}
          className="absolute left-[22px] rounded-full"
          style={{
            top: `${8 + i * 64}px`,
            width: 3,
            height: 3,
            background: 'var(--border-subtle)',
          }}
        />
      ))}
    </div>
  )
}

function Breadcrumb({ steps }: { steps: BreadcrumbStep[] }) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          {i > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              /
            </span>
          )}
          {step.href && !step.current ? (
            <button
              onClick={() => router.push(step.href!)}
              className="text-xs tracking-[0.2em] uppercase transition-colors duration-150 hover:underline underline-offset-4"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {step.label}
            </button>
          ) : (
            <span
              className="text-xs tracking-[0.2em] uppercase"
              style={{
                color: step.current ? 'var(--accent-amber)' : 'var(--text-tertiary)',
              }}
            >
              {step.label}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

export default function Shell({
  children,
  breadcrumb,
  rightAction,
  fullHeight = true,
  noSprocket = false,
}: ShellProps) {
  return (
    <div
      className={fullHeight ? 'flex h-screen w-screen flex-col overflow-hidden' : 'flex w-screen flex-col'}
      style={{ background: 'var(--canvas)' }}
    >
      {!noSprocket && <SprocketEdge />}

      {/* Top bar */}
      <div
        className="flex-none w-full border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div
          className="flex items-center justify-between py-4"
          style={{
            width: MAX_W,
            margin: '0 auto',
            paddingLeft: noSprocket ? 0 : 12,
          }}
        >
          {breadcrumb ? (
            <Breadcrumb steps={breadcrumb} />
          ) : (
            <p
              className="text-xs tracking-[0.25em] uppercase"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Director&apos;s Room
            </p>
          )}
          {rightAction && <div>{rightAction}</div>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div
          style={{
            width: MAX_W,
            margin: '0 auto',
            paddingLeft: noSprocket ? 0 : 12,
            height: '100%',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export function TopBar({
  breadcrumb,
  rightAction,
}: {
  breadcrumb?: BreadcrumbStep[]
  rightAction?: React.ReactNode
}) {
  const router = useRouter()

  return (
    <div
      className="flex-none w-full border-b"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div
        className="flex items-center justify-between py-4"
        style={{ width: MAX_W, margin: '0 auto' }}
      >
        {breadcrumb ? (
          <div className="flex items-center gap-2">
            {breadcrumb.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    /
                  </span>
                )}
                {step.href && !step.current ? (
                  <button
                    onClick={() => router.push(step.href!)}
                    className="text-xs tracking-[0.2em] uppercase transition-colors duration-150 hover:underline underline-offset-4"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {step.label}
                  </button>
                ) : (
                  <span
                    className="text-xs tracking-[0.2em] uppercase"
                    style={{
                      color: step.current ? 'var(--accent-amber)' : 'var(--text-tertiary)',
                    }}
                  >
                    {step.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p
            className="text-xs tracking-[0.25em] uppercase"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Director&apos;s Room
          </p>
        )}
        {rightAction && <div>{rightAction}</div>}
      </div>
    </div>
  )
}

export function ContentArea({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: MAX_W,
        margin: '0 auto',
        height: '100%',
      }}
    >
      {children}
    </div>
  )
}

export function Sprocket({ noSprocket = false }: { noSprocket?: boolean }) {
  if (noSprocket) return null
  return (
    <div
      className="fixed left-0 top-0 bottom-0 z-40 pointer-events-none"
      style={{ width: SPROCKET_OFFSET }}
    >
      <div
        className="absolute left-6 top-0 bottom-0"
        style={{ width: 1, background: 'var(--border-subtle)' }}
      />
      {Array.from({ length: 20 }, (_, i) => (
        <div
          key={i}
          className="absolute left-[22px] rounded-full"
          style={{
            top: `${8 + i * 64}px`,
            width: 3,
            height: 3,
            background: 'var(--border-subtle)',
          }}
        />
      ))}
    </div>
  )
}
