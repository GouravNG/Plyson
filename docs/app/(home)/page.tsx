import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="py-24 px-6 text-center max-w-5xl mx-auto flex flex-col items-center">
        <div className="mb-4 px-3 py-1 rounded-full border border-fd-primary/20 bg-fd-primary/5 text-fd-primary text-sm font-medium">
          Now in Beta — v0.1.6
        </div>
        <h1 className="text-5xl md:text-8xl font-black tracking-tight mb-6 bg-gradient-to-b from-fd-foreground to-fd-foreground/70 bg-clip-text text-transparent">
          API Testing <br /> <span className="text-fd-primary">Simplified.</span>
        </h1>
        <p className="text-xl md:text-2xl text-fd-muted-foreground mb-10 max-w-2xl leading-relaxed">
          A declarative, JSON-driven API testing framework built on top of Playwright. 
          Write tests as data, run them with speed.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/docs"
            className="px-8 py-4 rounded-xl bg-fd-primary text-fd-primary-foreground font-bold hover:brightness-110 transition-all shadow-lg shadow-fd-primary/20"
          >
            Read Documentation
          </Link>
          <Link
            href="https://github.com/GouravNG/Play-son"
            className="px-8 py-4 rounded-xl bg-fd-secondary text-fd-secondary-foreground font-bold hover:bg-fd-secondary/80 transition-all border border-fd-border"
          >
            View on GitHub
          </Link>
        </div>
      </section>

      {/* Code Preview Section */}
      <section className="py-12 px-6 w-full max-w-4xl">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-fd-primary to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-fd-card rounded-2xl border border-fd-border overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 bg-fd-muted/50 border-b border-fd-border">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/40"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/40"></div>
              <span className="ml-2 text-xs text-fd-muted-foreground font-mono">suites/Auth/auth-register.test.json</span>
            </div>
            <div className="p-6 font-mono text-sm sm:text-base leading-relaxed overflow-x-auto max-h-[600px]">
              <pre>
                <code className="text-fd-foreground">
{`{
  "title": "auth-controller",
  "description": "Comprehensive tests for the /auth/register endpoint",
  "testCases": [
    {
      "id": "auth-register-pos-001",
      "title": "Register a new user with valid data",
      "steps": [
        {
          "title": "Register as USER",
          "request": {
            "method": "POST",
            "endpoint": "/auth/register",
            "payload": {
              "email": { "$gen": "email" },
              "password": { "$gen": "alphanumeric", "length": "{{DEFAULT_PWD_LENGTH}}" },
              "firstname": { "$gen": "firstName" },
              "lastname": { "$gen": "lastName" }
            }
          },
          "response": {
            "validations": {
              "statusCode": 201,
              "assertions": [
                {
                  "title": "Role is USER",
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
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <FeatureCard 
          title="Declarative JSON" 
          description="Focus on what to test, not how. Write pure JSON suites that are easy to read, generate, and maintain." 
          icon="📄"
        />
        <FeatureCard 
          title="Playwright Engine" 
          description="Runs on top of Playwright for industrial-grade reliability, visual tracing, and powerful reporting." 
          icon="⚡"
        />
        <FeatureCard 
          title="Dynamic Generation" 
          description="Built-in Faker.js support allows you to generate random emails, names, and IDs for every request." 
          icon="🎲"
        />
        <FeatureCard 
          title="Variable Scoping" 
          description="Powerful interpolation engine with case, suite, environment, and global scopes for data reuse." 
          icon="🔗"
        />
        <FeatureCard 
          title="Schema Validation" 
          description="Automated JSON Schema validation for both requests (auto-fill) and responses." 
          icon="🛡️"
        />
        <FeatureCard 
          title="Custom Handlers" 
          description="Need more? Drop into TypeScript with custom handlers for complex assertions and logic." 
          icon="🛠️"
        />
      </section>

      {/* Footer / CTA */}
      <section className="py-24 px-6 text-center border-t border-fd-border w-full bg-fd-muted/30">
        <h2 className="text-3xl font-bold mb-4 text-fd-foreground">Ready to test?</h2>
        <p className="text-fd-muted-foreground mb-8">Start your first Plyson project in seconds.</p>
        <Link
          href="/docs/installation"
          className="px-8 py-4 rounded-xl bg-fd-primary text-fd-primary-foreground font-bold hover:brightness-110 transition-all shadow-lg shadow-fd-primary/20 inline-block"
        >
          Get Started with Installation
        </Link>
      </section>
    </main>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="p-8 rounded-2xl border border-fd-border bg-fd-card hover:border-fd-primary/30 hover:shadow-xl hover:shadow-fd-primary/5 transition-all group">
      <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="text-xl font-bold mb-3 text-fd-foreground">{title}</h3>
      <p className="text-fd-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
