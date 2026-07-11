"use client"
import Link from 'next/link';
import testPackage from '../../../packages/test/package.json';

export default function HomePage() {
  return (
    <main className="flex flex-col items-center overflow-hidden">
      {/* Hero Section - Split layout */}
      <section className="relative w-full max-w-7xl mx-auto px-6 py-20 md:py-28 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

        {/* Ambient glow */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-fd-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Left: Copy */}
        <div className="relative text-left">
          <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-fd-primary/20 bg-fd-primary/5 text-fd-primary text-sm font-medium fade-in-up" style={{ animationDelay: '0.05s' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-fd-primary animate-pulse-dot" />
            Now in Beta — v{testPackage.version}
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 text-fd-foreground fade-in-up" style={{ animationDelay: '0.15s' }}>
            Test your APIs
            <br />
            like{' '}
            <span className="relative inline-block">
              <span className="relative z-10 text-fd-background px-2">data.</span>
              <span className="absolute inset-0 bg-fd-primary rounded-lg -rotate-1 highlight-sweep" />
            </span>
          </h1>

          <p className="text-lg md:text-xl text-fd-muted-foreground mb-10 max-w-lg leading-relaxed fade-in-up" style={{ animationDelay: '0.3s' }}>
            A declarative, JSON-driven API testing framework built on top of Playwright.
            Write tests as data, run them with speed.
          </p>

          <div className="flex flex-wrap gap-4 mb-12 fade-in-up" style={{ animationDelay: '0.4s' }}>
            <Link
              href="/docs/test"
              className="btn-lift px-7 py-3.5 rounded-xl bg-fd-primary text-fd-primary-foreground font-bold shadow-lg shadow-fd-primary/20"
            >
              Read Documentation
            </Link>
            <Link
              href="https://github.com/GouravNG/Play-son"
              className="btn-lift px-7 py-3.5 rounded-xl bg-fd-secondary text-fd-secondary-foreground font-bold border border-fd-border inline-flex items-center gap-2"
            >
              View on GitHub
            </Link>
          </div>

          {/* Mini stats row */}
          <div className="flex gap-8 fade-in-up" style={{ animationDelay: '0.5s' }}>
            <Stat value="0 config" label="to get started" />
            <Stat value="100%" label="JSON-driven" />
            <Stat value="⚡ Fast" label="Playwright core" />
          </div>
        </div>

        {/* Right: Animated terminal / JSON typing */}
        <div className="relative fade-in-up" style={{ animationDelay: '0.35s' }}>
          <div className="absolute -inset-1 bg-gradient-to-br from-fd-primary/40 to-purple-600/30 rounded-2xl blur-xl opacity-40" />
          <div className="relative bg-fd-card rounded-2xl border border-fd-border overflow-hidden shadow-2xl float-card">
            <div className="flex items-center gap-2 px-4 py-3 bg-fd-muted/50 border-b border-fd-border">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-amber-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-fd-muted-foreground font-mono">auth-register.test.json</span>
              <span className="ml-auto flex items-center gap-1.5 text-xs text-green-500 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-dot" />
                201 PASS
              </span>
            </div>
            <div className="p-6 font-mono text-sm leading-relaxed overflow-x-auto max-h-[520px]">
              <pre className="json-block">
                <code className="text-fd-foreground">
{`{
  "title": "auth-controller",
  "testCases": [
    {
      "id": "auth-register-pos-001",
      "title": "Register a new user",
      "steps": [
        {
          "request": {
            "method": "POST",
            "endpoint": "/auth/register",
            "payload": {
              "email": { "$gen": "email" },
              "password": { "$gen": "alphanumeric" },
              "firstname": { "$gen": "firstName" }
            }
          },
          "response": {
            "validations": {
              "statusCode": 201,
              "assertions": [
                {
                  "path": "$.user.role",
                  "operator": "equals",
                  "value": "USER"
                }
              ]
            }
          }
        }
      ]
    }
  ]
}`}
                </code>
              </pre>
            </div>
          </div>

          {/* Floating badge chips */}
          <div className="absolute -right-4 top-16 px-3 py-1.5 rounded-lg bg-fd-card border border-fd-border shadow-lg text-xs font-mono text-fd-primary chip-float" style={{ animationDelay: '1s' }}>
            $gen: faker.js
          </div>
          <div className="absolute -left-6 bottom-24 px-3 py-1.5 rounded-lg bg-fd-card border border-fd-border shadow-lg text-xs font-mono text-green-500 chip-float" style={{ animationDelay: '1.4s' }}>
            ✓ schema valid
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 max-w-6xl mx-auto w-full">
        <div className="text-center mb-16 fade-in-up">
          <h2 className="text-3xl md:text-4xl font-bold text-fd-foreground mb-3">Everything you need, nothing you don't</h2>
          <p className="text-fd-muted-foreground max-w-xl mx-auto">Built for teams who want fast, readable, maintainable API test suites.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard delay="0.05s" title="Declarative JSON" description="Focus on what to test, not how. Write pure JSON suites that are easy to read, generate, and maintain." icon="📄" />
          <FeatureCard delay="0.1s" title="Playwright Engine" description="Runs on top of Playwright for industrial-grade reliability, visual tracing, and powerful reporting." icon="⚡" />
          <FeatureCard delay="0.15s" title="Dynamic Generation" description="Built-in Faker.js support allows you to generate random emails, names, and IDs for every request." icon="🎲" />
          <FeatureCard delay="0.2s" title="Variable Scoping" description="Powerful interpolation engine with case, suite, environment, and global scopes for data reuse." icon="🔗" />
          <FeatureCard delay="0.25s" title="Schema Validation" description="Automated JSON Schema validation for both requests (auto-fill) and responses." icon="🛡️" />
          <FeatureCard delay="0.3s" title="Custom Handlers" description="Need more? Drop into TypeScript with custom handlers for complex assertions and logic." icon="🛠️" />
        </div>
      </section>

      {/* Footer / CTA */}
      <section className="relative py-24 px-6 text-center border-t border-fd-border w-full bg-fd-muted/30 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-fd-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <h2 className="text-3xl font-bold mb-4 text-fd-foreground fade-in-up">Ready to test?</h2>
          <p className="text-fd-muted-foreground mb-8 fade-in-up" style={{ animationDelay: '0.1s' }}>Start your first Plyson project in seconds.</p>
          <Link
            href="/docs/test/getting-started/installation"
            className="btn-lift px-8 py-4 rounded-xl bg-fd-primary text-fd-primary-foreground font-bold shadow-lg shadow-fd-primary/20 inline-block fade-in-up"
            style={{ animationDelay: '0.2s' }}
          >
            Get Started with Installation
          </Link>
        </div>
      </section>

      <style jsx global>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in-up {
          opacity: 0;
          animation: fade-in-up 0.7s ease-out forwards;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        .animate-pulse-dot {
          animation: pulse-dot 1.8s ease-in-out infinite;
        }

        @keyframes highlight-sweep {
          from { transform: scaleX(0) rotate(-1deg); transform-origin: left; }
          to { transform: scaleX(1) rotate(-1deg); transform-origin: left; }
        }
        .highlight-sweep {
          animation: highlight-sweep 0.6s ease-out 0.5s both;
        }

        @keyframes float-card {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .float-card {
          animation: float-card 6s ease-in-out infinite;
        }

        @keyframes chip-float {
          0% { opacity: 0; transform: translateY(10px) scale(0.9); }
          15%, 85% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .chip-float {
          opacity: 0;
          animation: chip-float 0.6s ease-out forwards, float-card 5s ease-in-out infinite 1s;
        }

        .btn-lift {
          transition: transform 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease;
        }
        .btn-lift:hover { transform: translateY(-3px); filter: brightness(1.1); }
        .btn-lift:active { transform: translateY(-1px) scale(0.98); }

        @media (prefers-reduced-motion: reduce) {
          .fade-in-up, .animate-pulse-dot, .highlight-sweep, .float-card, .chip-float {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-lg font-bold text-fd-foreground">{value}</div>
      <div className="text-xs text-fd-muted-foreground">{label}</div>
    </div>
  );
}

function FeatureCard({ title, description, icon, delay }: { title: string; description: string; icon: string; delay?: string }) {
  return (
    <div
      className="fade-in-up p-8 rounded-2xl border border-fd-border bg-fd-card transition-all duration-300 hover:border-fd-primary/40 hover:shadow-xl hover:shadow-fd-primary/5 hover:-translate-y-1 group"
      style={{ animationDelay: delay }}
    >
      <div className="text-4xl mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">{icon}</div>
      <h3 className="text-xl font-bold mb-3 text-fd-foreground">{title}</h3>
      <p className="text-fd-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}