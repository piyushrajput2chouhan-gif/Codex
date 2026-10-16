import { useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, MessageCircle } from 'lucide-react';
import { waLink } from '@/data/apex-content';

type Errors = { name?: string; about?: string };
export function BookingForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [messageLink, setMessageLink] = useState('');
  const form = useRef<HTMLFormElement>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get('name') ?? '').trim();
    const about = String(values.get('about') ?? '').trim();
    const next: Errors = {};
    if (!name) next.name = 'Please enter your name.';
    if (!about) next.about = 'Tell us about the vehicle or café, location, and what you need.';
    setErrors(next);
    setMessageLink('');
    if (Object.keys(next).length) {
      (form.current?.elements.namedItem(next.name ? 'name' : 'about') as HTMLElement)?.focus();
      return;
    }
    const link = waLink(`Hi Apex Auto Captures! I'd like to discuss a shoot and request a custom quotation.\n\nName: ${name}\nShooting: ${values.get('type')}\nPreferred date: ${values.get('date') || 'Not specified'}\nAbout the shoot: ${about}`);
    setMessageLink(link);
    window.open(link, '_blank', 'noopener,noreferrer');
  }
  return <form ref={form} className="booking-form" onSubmit={submit} noValidate>
    <div className="form-top"><span className="micro">YOUR NEXT SHOOT STARTS HERE</span><MessageCircle size={20} /></div>
    <div className="form-pair"><div className="field"><label htmlFor="name">Your name <span>*</span></label><input id="name" name="name" autoComplete="name" placeholder="How should we call you?" required aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} onChange={() => setMessageLink('')} />{errors.name && <p className="field-error" id="name-error">{errors.name}</p>}</div><div className="field"><label htmlFor="type">What are we shooting?</label><select id="type" name="type" defaultValue="Car" onChange={() => setMessageLink('')}><option>Car</option><option>Café</option><option>Both</option></select></div></div>
    <div className="field"><label htmlFor="date">Preferred date <span className="optional">OPTIONAL</span></label><input type="date" id="date" name="date" onChange={() => setMessageLink('')} /></div>
    <div className="field"><label htmlFor="about">About the shoot <span>*</span></label><textarea id="about" name="about" rows={4} placeholder="Your car or café, the location, and what you have in mind…" required aria-invalid={!!errors.about} aria-describedby={errors.about ? 'about-error' : undefined} onChange={() => setMessageLink('')} />{errors.about && <p className="field-error" id="about-error">{errors.about}</p>}</div>
    <button type="submit" className="button button-accent form-submit">Let's talk on WhatsApp<ArrowUpRight size={20} /></button>
    <p className="form-note">Custom quotations. A conversation first.</p>
    {messageLink && <div className="form-status" role="status"><Check size={18} /><p>Your message is ready. Send it in WhatsApp to discuss your shoot. <a href={messageLink} target="_blank" rel="noreferrer">Open your message in WhatsApp ↗</a></p></div>}
  </form>;
}
