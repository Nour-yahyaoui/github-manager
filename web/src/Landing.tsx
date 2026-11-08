import { ArrowDown, ArrowRight, Box, Check, GitBranch, Github, Layers3, LockKeyhole, TerminalSquare } from 'lucide-react';
import './styles/landing.css';

const repoUrl = 'https://github.com/Nour-yahyaoui/github-manager';

export default function Landing() {
  return <div className="landing">
    <a className="landing-skip" href="#main">Skip to content</a>
    <header className="landing-header landing-wrap">
      <a className="landing-brand" href="/" aria-label="GitHub Manager home"><span className="brand-mark"><GitBranch size={19}/></span><span>github<span className="brand-light">manager</span><small> / CONTROL PLANE</small></span></a>
      <nav aria-label="Main navigation"><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href={repoUrl}>GitHub <span aria-hidden="true">↗</span></a></nav>
      <a className="nav-action" href="/app">Open workspace <ArrowRight size={16}/></a>
    </header>
    <main id="main">
      <section className="hero landing-wrap">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-dot"/> YOUR REPOSITORIES, IN FOCUS <span className="eyebrow-line"/> <span>01 / 03</span></div>
          <h1>Less tab switching.<br/><em>More shipping.</em></h1>
          <p className="hero-description">A local control plane for your GitHub repositories. Bring the everyday operations together, and get back to building.</p>
          <div className="hero-actions"><a className="landing-button primary" href="/app">Open workspace <ArrowRight size={18}/></a><a className="landing-button secondary" href={repoUrl}><Github size={18}/> View on GitHub</a></div>
          <p className="hero-note"><LockKeyhole size={14}/> Run locally. Connect your own GitHub token.</p>
        </div>
        <div className="product-frame" aria-label="Illustration of the repository ledger with example data">
          <div className="frame-top"><div className="window-dots"><i/><i/><i/></div><span>GITHUB MANAGER / WORKSPACE</span><span className="frame-status">● &nbsp;LOCAL</span></div>
          <div className="mock-app"><aside><div className="mock-logo"><GitBranch size={16}/></div><div className="mock-side active"><Layers3 size={16}/></div><div className="mock-side"><Box size={16}/></div><div className="mock-side"><TerminalSquare size={16}/></div><div className="mock-side bottom"><LockKeyhole size={16}/></div></aside>
          <div className="mock-content"><div className="mock-breadcrumb">WORKSPACE <span>/</span> REPOSITORIES</div><div className="mock-title"><div><h2>Repository ledger</h2><p>All your work, in one place.</p></div><span className="mock-new">+ New repo</span></div><div className="mock-filter"><span>⌕ &nbsp; Filter repositories...</span><span>☰ &nbsp; All repositories</span></div><div className="mock-label"><span>NAME / DESCRIPTION</span><span>VISIBILITY</span></div>
          {[['design-system','Shared foundations for the web','Public','TypeScript'],['api-gateway','Core services and integrations','Private','Rust'],['project-notes','Ideas, docs, and everything between','Private','Markdown']].map(([name,desc,visibility,lang]) => <div className="mock-row" key={name}><div><strong><Box size={14}/> {name}</strong><p>{desc}</p><small><i/> {lang} <span> · &nbsp; Updated recently</span></small></div><span className="mock-badge">{visibility}</span></div>)}
          <div className="mock-footer"><span>EXAMPLE DATA</span><span>YOUR WORK, ORGANIZED ↗</span></div></div></div>
          <div className="frame-caption"><span>FIG. 01 &nbsp; / &nbsp; THE REPOSITORY LEDGER</span><span>BUILT FOR THE DETAILS</span></div>
        </div>
      </section>
      <div className="landing-wrap hero-bottom"><span>AN INTENTIONAL WORKSPACE FOR GITHUB</span><a href="#features">EXPLORE THE TOOLKIT <ArrowDown size={14}/></a><span>SCROLL TO EXPLORE &nbsp; ↓</span></div>
      <section id="features" className="features"><div className="landing-wrap"><div className="section-heading"><div><div className="eyebrow">THE TOOLKIT <span className="eyebrow-line"/> 02 / 03</div><h2>One place for<br/><em>the moving parts.</em></h2></div><p>From a quick metadata edit to a bigger cleanup, keep the work close and the context closer.</p></div><div className="feature-grid">
        <article><span className="feature-number">01 / ORGANIZE</span><Layers3/><h3>A clearer view of your repos.</h3><p>Search and filter your repository ledger, then make quick edits without losing your place.</p></article>
        <article><span className="feature-number">02 / MANAGE</span><GitBranch/><h3>Go deeper when you need to.</h3><p>Work with branches, files, issues, releases, collaborators, and webhooks from a single workspace.</p></article>
        <article><span className="feature-number">03 / SCALE</span><Box/><h3>Make changes together.</h3><p>Apply supported updates across multiple repositories, with confirmation for destructive operations.</p></article>
      </div></div></section>
      <section id="how-it-works" className="how landing-wrap"><div><div className="eyebrow">GET STARTED <span className="eyebrow-line"/> 03 / 03</div><h2>Ready when<br/><em>you are.</em></h2><p>Run the app locally, connect a personal access token, or explore the clearly labeled sample workspace first.</p><a className="landing-button primary" href="/app">Go to workspace <ArrowRight size={18}/></a></div><div className="steps"><div><span>01</span><div><h3>Run it locally</h3><p>Start the Rust server and React interface on your machine.</p></div><Check size={18}/></div><div><span>02</span><div><h3>Connect or explore</h3><p>Use your GitHub token, or try the sample data without one.</p></div><Check size={18}/></div><div><span>03</span><div><h3>Get to work</h3><p>Find a repository and manage the details that matter.</p></div><Check size={18}/></div></div></section>
    </main><footer className="landing-footer"><div className="landing-wrap"><span className="footer-brand"><GitBranch size={18}/> githubmanager</span><span>MADE FOR THE WORK BEHIND THE WORK.</span><a href={repoUrl}>SOURCE ON GITHUB ↗</a></div></footer>
  </div>;
}
