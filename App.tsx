import { useRef, useState } from 'react';
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, Camera, Coffee, Instagram, Menu, MessageCircle, X } from 'lucide-react';
import { SceneHero, type Scene } from '@/components/scene-hero';
import { SceneTabs } from '@/components/scene-tabs';
import SlidingPuzzleGallery from '@/components/ui/sliding-puzzle-gallery';
import HalftoneWordmarkFooter from '@/components/ui/halftone-wordmark-footer';
import { BookingForm } from '@/components/booking-form';
import { site, services, work, waLink, defaultWa } from '@/data/apex-content';
import { publicAsset } from '@/lib/public-asset';

const photos = {
  cars: work.cars.map(item => ({ ...item, src: publicAsset(item.src) })),
  cafes: work.cafes.map(item => ({ ...item, src: publicAsset(item.src) })),
};
function Brand() {
  return <a href="#top" className="brand" aria-label="Apex Auto Captures — back to top"><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="m3 32 14-25h6l14 25H27l-7-13-7 13H3Z" fill="currentColor" /><path d="M17 28h6" stroke="#10110f" strokeWidth="3" /></svg><span>APEX<span>AUTO CAPTURES</span></span></a>;
}
function Work() {
  const [tab, setTab] = useState<Scene>('cars');
  const [indices, setIndices] = useState({ cars: 0, cafes: 0 });
  const panel = useRef<HTMLDivElement>(null);
  const visible = useInView(panel, { once: true, margin: '300px' });
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: panel, offset: ['start end', 'start 30%'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [16, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [.92, 1]);
  return <section id="work" className="work-section section-shell">
    <div className="section-kicker"><span className="micro"><span className="tiny-square" /> 01 / SELECTED WORK</span><span className="micro muted">LOOK CLOSER. PLAY A LITTLE.</span></div>
    <div className="work-heading"><h2>Every shot,<br /><span>put back together.</span></h2><div className="work-intro"><ArrowDownRight size={38} strokeWidth={1} /><p>The photos shuffle and solve themselves. Tap a tile, or use the arrow keys, to slide it yourself.</p><SceneTabs id="work-tabs" value={tab} onChange={setTab} /></div></div>
    <div className="gallery-perspective" ref={panel}><motion.div className="gallery-panel" style={reduced ? undefined : { rotateX, scale }}>
      <div className="gallery-top"><span className="micro">THE INTERACTIVE CONTACT SHEET</span><span className="micro">{tab === 'cars' ? 'AUTOMOTIVE' : 'CAFÉ STORIES'} <span className="accent-text">↗</span></span></div>
      <div role="tabpanel" id="work-panel" aria-labelledby={`work-tabs-${tab}`} tabIndex={0}>{visible ? <><SlidingPuzzleGallery key={tab} items={photos[tab]} size={4} hold={2600} defaultIndex={indices[tab]} onIndexChange={index => setIndices(previous => ({ ...previous, [tab]: index }))} aria-describedby="work-photo-description" /><span id="work-photo-description" className="sr-only">{photos[tab][indices[tab]]?.alt}</span></> : <div className="gallery-reserved">SELECTED WORK / SCROLL TO EXPLORE</div>}</div>
      <div className="gallery-bottom"><span className="micro">PHOTOGRAPHY BY APEX AUTO CAPTURES</span><span className="micro"><span className="live-dot" /> MADE TO BE EXPLORED</span></div>
    </motion.div></div>
  </section>;
}

export default function App() {
  const [scene, setScene] = useState<Scene>('cars');
  const [menu, setMenu] = useState(false);
  const { scrollYProgress } = useScroll();
  const accent = scene === 'cars' ? '#c6ad7c' : '#d7a878';
  return <div className={`site ${scene === 'cafes' ? 'cafe-active' : ''}`} style={{ '--site-accent': accent } as React.CSSProperties}>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="header"><div className="header-inner"><Brand /><nav className={menu ? 'main-nav open' : 'main-nav'} aria-label="Main navigation"><a href="#work" onClick={() => setMenu(false)}>Work</a><a href="#services" onClick={() => setMenu(false)}>Services</a><a href="#book" onClick={() => setMenu(false)}>Book a shoot<ArrowUpRight size={14} /></a></nav><a className="header-whatsapp" href={waLink(defaultWa)} target="_blank" rel="noreferrer"><MessageCircle size={16} /><span>Let's talk</span><ArrowUpRight size={14} /></a><button className="menu-button" onClick={() => setMenu(!menu)} aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu}>{menu ? <X size={22} /> : <Menu size={22} />}</button></div><motion.div className="header-progress" style={{ scaleX: scrollYProgress, originX: 0 }} /></header>
    <main id="main" tabIndex={-1}>
      <div id="hero-panel" role="tabpanel" aria-labelledby={`hero-scenes-${scene}`}><SceneHero active={scene} onChange={setScene} /></div>
      <div className="studio-strip"><span>THE LINES. THE LIGHT. <em>THE FEELING.</em></span><span className="strip-end"><Camera size={20} strokeWidth={1.3} /> CARS & CAFÉS, THROUGH OUR LENS.</span></div>
      <Work />
      <section id="services" className="services-section section-shell"><div className="section-kicker"><span className="micro"><span className="tiny-square" /> 02 / WHAT WE SHOOT</span><span className="micro muted">STILLS. MOTION. ATMOSPHERE.</span></div><div className="section-heading"><h2>Two sides.<br /><span>One eye.</span></h2><p>Every project is quoted on its own. Pick a service, or tell us what you have in mind.</p></div>
        <div className="service-columns">{(['cars', 'cafes'] as const).map((type, column) => <div className="service-column" key={type}><div className="service-title"><span className="service-icon">{type === 'cars' ? <Camera size={25} strokeWidth={1.3} /> : <Coffee size={25} strokeWidth={1.3} />}</span><h3>{type === 'cars' ? 'Cars' : 'Cafés'}</h3><span className="micro">0{column + 1}</span></div>{services[type].map(([name, description], index) => <article className="service-row" key={name}><span className="service-number">0{index + 1}</span><div><h4>{name}</h4><p>{description}</p></div><a className="service-link" href={waLink(`Hi Apex Auto Captures! I'd like to discuss ${name} for ${type === 'cars' ? 'a car' : 'a café'} and request a custom quotation.`)} target="_blank" rel="noreferrer" aria-label={`Ask about ${name} on WhatsApp`}><ArrowUpRight size={20} /></a></article>)}</div>)}</div>
      </section>
      <section id="book" className="book-section section-shell"><div className="section-kicker"><span className="micro"><span className="tiny-square" /> 03 / MAKE SOMETHING WORTH SEEING</span><ArrowUpRight size={24} /></div><div className="book-grid"><div className="book-copy"><h2>Have a<br />project<br /><span>in mind?</span></h2><p>Tell us about your car or café. This opens WhatsApp with your message ready to send. Ibrahim confirms every booking himself.</p><div className="contact-block"><a href={`mailto:${site.email}`}>{site.email}<ArrowUpRight size={16} /></a><a className="contact-phone" href="tel:+919701414074">{site.phone.display}</a><a className="contact-instagram" href={site.instagram.url} target="_blank" rel="noreferrer"><Instagram size={16} />{site.instagram.handle}<ArrowUpRight size={16} /></a></div></div><BookingForm /></div></section>
    </main>
    <div className="footer-wrap w-full"><HalftoneWordmarkFooter wordmark="IBRAHIM" label="Apex Auto Captures" meta={`©${new Date().getFullYear()} · Car and café photography`} crop={0.16} height="var(--footer-height)" fontFamily={'"Barlow Condensed", "Helvetica Neue", Arial, sans-serif'} fontWeight={900} palette={{ background: '#0a0b09', ink: '#e8eadf', warm: accent }} columns={[
      { title: 'Work', links: [{ label: 'Cars', href: '#work' }, { label: 'Cafés', href: '#work' }] },
      { title: 'Studio', links: [{ label: 'Services', href: '#services' }, { label: 'Book a shoot', href: '#book' }] },
      { title: 'Contact', links: [{ label: 'WhatsApp', href: waLink() }, { label: site.instagram.handle, href: site.instagram.url }, { label: site.email, href: `mailto:${site.email}` }] },
    ]} /></div>
  </div>;
}
