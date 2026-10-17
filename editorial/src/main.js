import '@fontsource/bodoni-moda/latin-400.css';
import '@fontsource/bodoni-moda/latin-400-italic.css';
import './style.css';
import arrowUpRight from '@phosphor-icons/core/assets/regular/arrow-up-right.svg';
import arrowDown from '@phosphor-icons/core/assets/regular/arrow-down.svg';
import arrowUp from '@phosphor-icons/core/assets/regular/arrow-up.svg';
import arrowLeft from '@phosphor-icons/core/assets/regular/arrow-left.svg';
import arrowRight from '@phosphor-icons/core/assets/regular/arrow-right.svg';
import closeIcon from '@phosphor-icons/core/assets/regular/x.svg';
import expandIcon from '@phosphor-icons/core/assets/regular/arrows-out-simple.svg';
import { FrameSequence } from './sequence.js';
import { assetURL } from './asset-url.js';

const icons = { 'arrow-up-right': arrowUpRight, 'arrow-down': arrowDown, 'arrow-up': arrowUp, 'arrow-left': arrowLeft, 'arrow-right': arrowRight, x: closeIcon };
document.querySelectorAll('[data-icon]').forEach(image => { image.src = icons[image.dataset.icon]; });

const photo = (id, category, title, alt) => ({ id, category, title, alt, src: assetURL(`work/${id}.webp`) });
const photographs = [
  photo('car-orange-front', 'Cars', 'Lamborghini / Front', 'An orange Lamborghini photographed from above, with its angular headlights and bonnet in view.'),
  photo('cafe-interior', 'Cafés', 'Interiors / Warm light', 'A café interior with glowing hanging bulbs, timber branches, green plants and orange chairs.'),
  photo('car-huracan', 'Cars', 'Lamborghini / Reflections', 'Tree branches reflected across the glossy black bonnet and windscreen of a Lamborghini.'),
  photo('car-orange-light', 'Cars', 'Lamborghini / Lines', 'A close view of an orange Lamborghini headlight and the sculpted lines of its bonnet.'),
  photo('cafe-berry-mojito', 'Cafés', 'On the table / Berry', 'A tall red and pink drink garnished with a citrus slice, photographed in warm café light.'),
  photo('car-black-bmw', 'Cars', 'BMW / In the light', 'The front corner of a dark BMW with its headlight, grille and bronze wheel visible.'),
  photo('car-orange-rear', 'Cars', 'Lamborghini / Rear', 'The rear of an orange Lamborghini, showing the engine cover, tail lights and rear diffuser.'),
  photo('cafe-sushi', 'Cafés', 'On the table / Colour', 'Colourful sushi rolls arranged on a white rectangular plate on a café table.'),
  photo('car-blue-bmw', 'Cars', 'BMW / Blue', 'A light blue BMW photographed from the front on a paved forecourt.'),
  photo('car-orange-v10', 'Cars', 'Lamborghini / Details', 'The V10 badge and vent on the orange bodywork of a Lamborghini.'),
  photo('cafe-bar', 'Cafés', 'Interiors / At the bar', 'A softly illuminated café bar beneath hanging plants and warm bulbs.'),
  photo('cafe-chandelier', 'Cafés', 'Interiors / Overhead', 'A café filled with sculptural timber branches and suspended warm light bulbs.'),
  photo('cafe-brownie', 'Cafés', 'On the table / Something sweet', 'A brownie topped with ice cream on a wooden serving board, with soft café lights behind.'),
  photo('cafe-pineapple-mojito', 'Cafés', 'On the table / Pineapple', 'A pale green drink in a tall glass with pineapple garnish in warm light.'),
  photo('cafe-dosa-pot', 'Cafés', 'On the table / A closer look', 'A plated dish presented in a small pot with accompaniments on a café table.'),
  photo('cafe-mojito-hands', 'Cafés', 'Details / The finishing touch', 'Hands passing a garnished drink across a café bar.'),
  photo('cafe-spinach-dish', 'Cafés', 'On the table / Greens', 'A vibrant green dish on a white plate, photographed against a softly blurred café interior.'),
];
const photoById = new Map(photographs.map(item => [item.id, item]));
const selectedIds = ['car-huracan', 'car-orange-light', 'cafe-berry-mojito', 'car-black-bmw', 'car-orange-rear', 'cafe-sushi', 'car-blue-bmw', 'car-orange-v10'];
const cafeIds = ['cafe-bar', 'cafe-chandelier', 'cafe-brownie', 'cafe-pineapple-mojito', 'cafe-dosa-pot', 'cafe-mojito-hands', 'cafe-spinach-dish', 'cafe-interior'];
let filter = 'All';

function createFigure(item, className) {
  const figure = document.createElement('figure');
  figure.className = className;
  const button = document.createElement('button');
  button.className = 'photo-button';
  button.dataset.photo = item.id;
  button.setAttribute('aria-label', `Open ${item.title} photograph`);
  const image = document.createElement('img');
  Object.assign(image, { src: item.src, alt: item.alt, loading: 'lazy', decoding: 'async', width: 1000, height: 1000 });
  const open = document.createElement('span');
  open.className = 'photo-open';
  open.setAttribute('aria-hidden', 'true');
  const icon = document.createElement('img');
  Object.assign(icon, { src: expandIcon, alt: '', width: 18, height: 18 });
  open.append(icon);
  button.append(image, open);
  const caption = document.createElement('figcaption');
  const title = document.createElement('span');
  title.textContent = item.title;
  const category = document.createElement('span');
  category.className = 'photo-category';
  category.textContent = item.category;
  caption.append(title, category);
  figure.append(button, caption);
  return figure;
}

function selectedPhotos() {
  return selectedIds.map(id => photoById.get(id)).filter(item => filter === 'All' || item.category === filter);
}

function setFilter(next, announce = true) {
  filter = next;
  document.querySelectorAll('[data-filter]').forEach(button => {
    const active = button.dataset.filter === filter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const items = selectedPhotos();
  document.querySelector('#work-grid').replaceChildren(...items.map(item => createFigure(item, 'work-item')));
  if (announce) document.querySelector('#gallery-status').textContent = `Showing ${items.length} ${filter === 'All' ? '' : `${filter.toLowerCase()} `}photographs.`;
}

setFilter('All', false);
document.querySelector('#cafe-grid').replaceChildren(...cafeIds.map(id => createFigure(photoById.get(id), 'cafe-item')));
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => setFilter(button.dataset.filter)));
document.querySelectorAll('[data-category-link]').forEach(link => link.addEventListener('click', () => setFilter(link.dataset.categoryLink)));

// Native modal dialogs keep background controls inert and contain keyboard focus.
const lightbox = document.querySelector('.lightbox');
const lightboxImage = lightbox.querySelector('.lightbox-image');
let activePhotos = [];
let activePhoto = 0;
let opener = null;

function showPhoto(index) {
  activePhoto = (index + activePhotos.length) % activePhotos.length;
  const item = activePhotos[activePhoto];
  lightboxImage.src = item.src;
  lightboxImage.alt = item.alt;
  lightbox.querySelector('#lightbox-title').textContent = `${item.category} — ${item.title}`;
  lightbox.querySelector('.lightbox-position').textContent = `${activePhoto + 1} / ${activePhotos.length}`;
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-photo]');
  if (!button) return;
  opener = button;
  if (button.closest('#work-grid')) activePhotos = selectedPhotos();
  else if (button.closest('#cafe-grid')) activePhotos = cafeIds.map(id => photoById.get(id));
  else activePhotos = [photoById.get('car-orange-front'), photoById.get('cafe-interior')];
  showPhoto(activePhotos.findIndex(item => item.id === button.dataset.photo));
  lightbox.showModal();
  document.body.classList.add('lightbox-open');
  lightbox.querySelector('.lightbox-close').focus();
});
lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
lightbox.querySelector('.lightbox-previous').addEventListener('click', () => showPhoto(activePhoto - 1));
lightbox.querySelector('.lightbox-next').addEventListener('click', () => showPhoto(activePhoto + 1));
lightbox.addEventListener('keydown', event => {
  if (event.key === 'Tab') {
    const controls = [...lightbox.querySelectorAll('button')];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  if (event.key === 'ArrowRight') { event.preventDefault(); showPhoto(activePhoto + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); showPhoto(activePhoto - 1); }
});
lightbox.addEventListener('close', () => {
  document.body.classList.remove('lightbox-open');
  if (opener?.isConnected) opener.focus({ preventScroll: true });
});

// Prepare a message only. The visitor sends it themselves in WhatsApp.
const enquiry = document.querySelector('#enquiry-message');
const send = document.querySelector('#whatsapp-send');
enquiry.addEventListener('input', () => {
  const detail = enquiry.value.trim();
  const text = `Hi Apex Auto Captures, I’d like to enquire about a custom quote.${detail ? `\n\n${detail}` : ''}`;
  send.href = `https://wa.me/919701414074?text=${encodeURIComponent(text)}`;
});

const mobileAction = document.querySelector('.mobile-action');
let heroActionVisible = true;
let enquiryVisible = false;
const updateMobileAction = () => { mobileAction.hidden = heroActionVisible || enquiryVisible; };
new IntersectionObserver(entries => {
  heroActionVisible = entries[0].isIntersecting;
  updateMobileAction();
}).observe(document.querySelector('.hero-enquiry'));
new IntersectionObserver(entries => {
  enquiryVisible = entries[0].isIntersecting;
  updateMobileAction();
}).observe(document.querySelector('.enquiry-panel'));

new FrameSequence(document.querySelector('.motion-section'));
