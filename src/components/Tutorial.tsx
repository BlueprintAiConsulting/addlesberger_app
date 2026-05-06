import { useState, useEffect, useCallback, ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Inbox, Briefcase, FileText, Receipt,
  Camera, Settings, Sun, Moon, ChevronRight, ChevronLeft,
  X, Sparkles, CheckCircle2
} from 'lucide-react'

const STORAGE_KEY = 'rl-tutorial-done'

interface Step {
  title: string
  description: string
  icon: ReactNode
  route?: string
  tip?: string
}

const steps: Step[] = [
  {
    title: 'Welcome to Whiteboard Sync! 👋',
    description: "This is your digital command center — everything from your office whiteboard, now on your phone. Let's take a quick tour so you can hit the ground running.",
    icon: <Sparkles size={28} />,
  },
  {
    title: 'Today — Your Daily Snapshot',
    description: "This is your home base. See today's jobs at a glance — what's scheduled, what needs attention, and your key stats. Tap any job card to jump straight to the details.",
    icon: <LayoutDashboard size={28} />,
    route: '/',
    tip: 'Check this screen every morning to see your day ahead.',
  },
  {
    title: 'Board — Your Digital Whiteboard',
    description: "This replaces the office whiteboard. Drag leads through columns: Inbox → Quoted → Scheduled → In Progress → Done. Snap a photo of the whiteboard and we'll auto-import it!",
    icon: <Inbox size={28} />,
    route: '/board',
    tip: 'Use the 📷 camera button to scan your physical whiteboard.',
  },
  {
    title: 'Jobs — All Your Projects',
    description: 'Every roofing job lives here. Filter by status, search by customer name, and tap into any job to see the full history — materials, notes, photos, everything.',
    icon: <Briefcase size={28} />,
    route: '/jobs',
    tip: 'Tap the + button to create a new job from scratch.',
  },
  {
    title: 'Estimates — Quote Fast',
    description: 'Build and send professional estimates right from the field. Pull up material costs, add line items, and email it to the customer before you even leave the driveway.',
    icon: <FileText size={28} />,
    route: '/estimates',
    tip: 'Estimates auto-link to their job for easy tracking.',
  },
  {
    title: 'Invoices — Get Paid',
    description: "Track every invoice from draft to paid. See what's outstanding at a glance and follow up on overdue payments. No more paper invoices getting lost in the truck.",
    icon: <Receipt size={28} />,
    route: '/invoices',
    tip: 'Overdue invoices show up in red so you never miss them.',
  },
  {
    title: 'Photos — Job Documentation',
    description: "Every photo attached to a job is organized here. Before, during, and after shots — all searchable. Great for insurance documentation and customer follow-ups.",
    icon: <Camera size={28} />,
    route: '/photos',
    tip: 'Photos are linked to their job automatically.',
  },
  {
    title: 'Settings & Dark Mode',
    description: "Update your company info and profile here. And see that ☀️ / 🌙 icon in the header? Tap it anytime to switch between light and dark mode — whatever's easier on your eyes.",
    icon: <Settings size={28} />,
    route: '/settings',
    tip: 'Your theme preference is saved automatically.',
  },
  {
    title: "You're All Set! 🎉",
    description: "That's everything you need. This app works offline-first, so it's fast even on spotty job-site connections. If you ever want to see this tour again, you can restart it from Settings.",
    icon: <CheckCircle2 size={28} />,
  },
]

export function useTutorial() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) setShow(true)
  }, [])

  const start = useCallback(() => setShow(true), [])
  const dismiss = useCallback(() => {
    setShow(false)
    localStorage.setItem(STORAGE_KEY, 'true')
  }, [])

  return { showTutorial: show, startTutorial: start, dismissTutorial: dismiss }
}

export function TutorialOverlay({
  onClose,
}: {
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const current = steps[step]
  const isFirst = step === 0
  const isLast = step === steps.length - 1
  const progress = ((step + 1) / steps.length) * 100

  // Navigate to the step's route when step changes
  useEffect(() => {
    if (current.route && location.pathname !== current.route) {
      navigate(current.route)
    }
  }, [step, current.route])

  const next = () => {
    if (isLast) {
      onClose()
    } else {
      setStep(s => s + 1)
    }
  }

  const prev = () => {
    if (!isFirst) setStep(s => s - 1)
  }

  const skip = () => {
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.6)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      animation: 'fadeIn .2s ease-out',
    }}>
      <div style={{
        width: '100%', maxWidth: 440,
        background: 'var(--surface)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,.4)',
        border: '1px solid var(--border-light)',
        animation: 'slideUp .3s cubic-bezier(0,0,.2,1)',
      }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--border-light)' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--brand), var(--brand-light))',
            borderRadius: 4,
            transition: 'width .3s ease',
          }} />
        </div>

        {/* Header with step counter & skip */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 0',
        }}>
          <span style={{
            fontSize: 12, fontWeight: 700, color: 'var(--muted)',
            letterSpacing: '.06em', textTransform: 'uppercase',
          }}>
            Step {step + 1} of {steps.length}
          </span>
          <button
            onClick={skip}
            aria-label="Skip tutorial"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: 'var(--muted)',
              padding: '4px 8px', borderRadius: 8,
            }}
          >
            Skip <X size={16} />
          </button>
        </div>

        {/* Icon + Content */}
        <div style={{ padding: '20px 24px 8px', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'var(--brand-subtle)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, color: 'var(--brand)',
          }}>
            {current.icon}
          </div>
          <h2 style={{
            fontSize: 20, fontWeight: 800, margin: '0 0 10px',
            color: 'var(--text)', lineHeight: 1.3,
          }}>
            {current.title}
          </h2>
          <p style={{
            fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)',
            margin: 0, maxWidth: 360, marginInline: 'auto',
          }}>
            {current.description}
          </p>

          {current.tip && (
            <div style={{
              marginTop: 16, padding: '10px 16px',
              background: 'var(--brand-subtle)',
              borderRadius: 10, fontSize: 13, fontWeight: 600,
              color: 'var(--brand)', display: 'inline-flex',
              alignItems: 'center', gap: 8,
            }}>
              💡 {current.tip}
            </div>
          )}
        </div>

        {/* Step dots */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 6,
          padding: '16px 0 8px',
        }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 24 : 8, height: 8,
                borderRadius: 4,
                background: i === step ? 'var(--brand)' : 'var(--border)',
                transition: 'all .25s ease',
              }}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div style={{
          display: 'flex', gap: 10, padding: '12px 20px 20px',
        }}>
          {!isFirst && (
            <button
              onClick={prev}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, padding: '12px 20px', minHeight: 48,
                background: 'var(--bg)', border: '1.5px solid var(--border)',
                borderRadius: 12, cursor: 'pointer', fontSize: 15,
                fontWeight: 700, color: 'var(--text)', fontFamily: 'inherit',
                transition: 'all .15s ease',
              }}
            >
              <ChevronLeft size={18} /> Back
            </button>
          )}
          <button
            onClick={next}
            style={{
              flex: isFirst ? 1 : 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, padding: '12px 20px', minHeight: 48,
              background: 'linear-gradient(135deg, var(--brand), var(--brand-light))',
              border: 'none', borderRadius: 12, cursor: 'pointer',
              fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'inherit',
              boxShadow: 'var(--shadow-glow)',
              transition: 'all .15s ease',
            }}
          >
            {isFirst ? "Let's Go!" : isLast ? "Start Using the App" : 'Next'}
            {!isLast && <ChevronRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}
