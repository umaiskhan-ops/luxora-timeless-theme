/* ==========================================================================
   LUXORA JEWELRY — theme.js
   Vanilla ES6+. AJAX cart, variant grouping, zoom, accordion, menus, etc.
   ========================================================================== */
(() => {
  'use strict';

  const CFG = window.LUXORA || {};
  const routes = CFG.routes || {};
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------------- Money ---------------- */
  const formatMoney = (cents) => {
    const fmt = CFG.moneyFormat || '${{amount}}';
    const value = (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return fmt.replace(/\{\{\s*\w+\s*\}\}/, value);
  };

  /* ---------------- Toast ---------------- */
  const toast = (msg, type = 'success') => {
    const root = $('#ToastRoot'); if (!root) return;
    const el = document.createElement('div');
    el.className = 'animate-slide-in px-5 py-3 text-sm text-white shadow-lg ' + (type === 'error' ? 'bg-red-600' : 'bg-navy border border-gold/50');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; setTimeout(() => el.remove(), 400); }, 2800);
  };

  /* ---------------- Cart API ---------------- */
  const Cart = {
    async get() {
      const r = await fetch(`${routes.cart_url || '/cart'}.js`, { headers: { 'Accept': 'application/json' } });
      return r.json();
    },
    async add(items) {
      const r = await fetch(routes.cart_add_url || '/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ items })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.description || data.message || 'Could not add to cart');
      return data;
    },
    async change(payload) {
      const r = await fetch(routes.cart_change_url || '/cart/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      return r.json();
    }
  };

  /* ---------------- Cart Drawer render ---------------- */
  const renderCart = (cart) => {
    CFG.cartCount = cart.item_count;
    $$('[data-cart-count]').forEach((n) => {
      n.textContent = cart.item_count;
      n.classList.toggle('hidden', cart.item_count === 0);
    });
    $$('[data-cart-total]').forEach((n) => (n.textContent = formatMoney(cart.total_price)));

    // Free shipping progress
    const threshold = CFG.freeShippingThreshold || 0;
    $$('[data-shipping-progress]').forEach((wrap) => {
      const bar  = $('[data-shipping-bar]', wrap);
      const text = $('[data-shipping-text]', wrap);
      const pct  = threshold ? Math.min(100, (cart.total_price / threshold) * 100) : 100;
      if (bar) bar.style.width = pct + '%';
      if (text) {
        text.innerHTML = cart.total_price >= threshold
          ? 'Congratulations! You have unlocked <strong>free express shipping</strong>.'
          : `You are <strong>${formatMoney(threshold - cart.total_price)}</strong> away from free express shipping.`;
      }
    });

    const list = $('[data-cart-items]');
    if (list) {
      if (!cart.items.length) {
        list.innerHTML = `<div class="py-16 text-center">
          <p class="font-display text-xl">Your cart is empty</p>
          <p class="mt-2 text-sm text-ink/60">Discover our exquisite collections.</p>
          <a href="/collections/all" class="btn btn-gold mt-6">Shop Collection</a></div>`;
      } else {
        list.innerHTML = cart.items.map((item, i) => `
          <div class="flex gap-4 border-b border-black/5 py-5" data-line="${i + 1}">
            <a href="${item.url}" class="w-20 shrink-0 overflow-hidden bg-soft">
              ${item.image ? `<img src="${item.image.replace(/(\.[^.]*)$/, '_200x$1')}" alt="${item.product_title}" class="h-24 w-full object-cover">` : ''}
            </a>
            <div class="flex-1">
              <a href="${item.url}" class="font-display text-base leading-snug hover:text-gold">${item.product_title}</a>
              ${item.variant_title && item.variant_title !== 'Default Title' ? `<p class="mt-1 text-xs uppercase tracking-widest text-ink/50">${item.variant_title}</p>` : ''}
              <div class="mt-3 flex items-center justify-between">
                <div class="inline-flex items-center border border-black/10">
                  <button class="px-3 py-1 text-lg leading-none hover:text-gold" data-qty-change="${i + 1}" data-qty="${item.quantity - 1}" aria-label="Decrease quantity">&minus;</button>
                  <span class="w-9 text-center text-sm">${item.quantity}</span>
                  <button class="px-3 py-1 text-lg leading-none hover:text-gold" data-qty-change="${i + 1}" data-qty="${item.quantity + 1}" aria-label="Increase quantity">+</button>
                </div>
                <span class="text-sm font-semibold">${formatMoney(item.final_line_price)}</span>
              </div>
              <button class="mt-2 text-[11px] uppercase tracking-widest text-ink/45 underline hover:text-gold" data-qty-change="${i + 1}" data-qty="0">Remove</button>
            </div>
          </div>`).join('');
      }
    }
  };

  const refreshCart = async () => renderCart(await Cart.get());

  /* ---------------- Drawer open/close ---------------- */
  const openDrawer = (id) => {
    const d = document.getElementById(id); if (!d) return;
    d.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
  };
  const closeDrawer = (d) => {
    d.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
  };

  document.addEventListener('click', async (e) => {
    const openBtn = e.target.closest('[data-drawer-open]');
    if (openBtn) { e.preventDefault(); openDrawer(openBtn.dataset.drawerOpen); if (openBtn.dataset.drawerOpen === 'CartDrawer') refreshCart(); return; }

    const closeBtn = e.target.closest('[data-drawer-close]');
    if (closeBtn) { const d = closeBtn.closest('.drawer'); if (d) closeDrawer(d); return; }

    if (e.target.classList && e.target.classList.contains('drawer__overlay')) {
      closeDrawer(e.target.closest('.drawer')); return;
    }

    /* Quantity change (drawer + cart page) */
    const qtyBtn = e.target.closest('[data-qty-change]');
    if (qtyBtn) {
      e.preventDefault();
      const cart = await Cart.change({ line: Number(qtyBtn.dataset.qtyChange), quantity: Number(qtyBtn.dataset.qty) });
      renderCart(cart);
      if (document.body.classList.contains('template-cart')) window.location.reload();
      return;
    }

    /* Quick add / add to cart */
    const addBtn = e.target.closest('[data-add-to-cart]');
    if (addBtn) {
      e.preventDefault();
      const id  = addBtn.dataset.variantId || $('[name="id"]', addBtn.closest('form') || document)?.value;
      const qty = Number(addBtn.dataset.quantity || $('[name="quantity"]', addBtn.closest('form') || document)?.value || 1);
      if (!id) return;
      const label = addBtn.innerHTML;
      addBtn.disabled = true; addBtn.innerHTML = 'Adding…';
      try {
        await Cart.add([{ id: Number(id), quantity: qty }]);
        await refreshCart();
        openDrawer('CartDrawer');
        toast('Added to your cart');
      } catch (err) { toast(err.message, 'error'); }
      finally { addBtn.disabled = false; addBtn.innerHTML = label; }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $$('.drawer[aria-hidden="false"]').forEach(closeDrawer);
  });

  /* ---------------- Product form submit ---------------- */
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-product-form]');
    if (!form) return;
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await Cart.add([{ id: Number(fd.get('id')), quantity: Number(fd.get('quantity') || 1) }]);
      await refreshCart();
      openDrawer('CartDrawer');
      toast('Added to your cart');
    } catch (err) { toast(err.message, 'error'); }
  });

  /* ---------------- Quantity steppers (product page) ---------------- */
  document.addEventListener('click', (e) => {
    const step = e.target.closest('[data-qty-step]');
    if (!step) return;
    const input = $('[data-qty-input]', step.closest('[data-qty-wrapper]'));
    if (!input) return;
    const next = Math.max(1, Number(input.value || 1) + Number(step.dataset.qtyStep));
    input.value = next;
  });

  /* ---------------- Variant selection + image grouping ---------------- */
  class VariantPicker {
    constructor(root) {
      this.root = root;
      this.variants = JSON.parse($('[data-variant-json]', root)?.textContent || '[]');
      this.root.addEventListener('change', () => this.update());
      $$('[data-swatch]', this.root).forEach((sw) => sw.addEventListener('click', () => this.selectSwatch(sw)));
      this.update();
    }
    selectSwatch(sw) {
      const group = sw.dataset.optionIndex;
      $$(`[data-swatch][data-option-index="${group}"]`, this.root).forEach((s) => s.setAttribute('aria-checked', 'false'));
      sw.setAttribute('aria-checked', 'true');
      const input = $(`[data-option-input="${group}"]`, this.root);
      if (input) input.value = sw.dataset.value;
      this.update();
    }
    get selectedOptions() {
      return $$('[data-option-input]', this.root).map((i) => i.value);
    }
    update() {
      const opts = this.selectedOptions;
      const variant = this.variants.find((v) => v.options.every((o, i) => o === opts[i]));
      const idInput = $('[name="id"]', this.root);
      const btn = $('[data-atc-button]', this.root);
      const priceEl = $('[data-price]', this.root);
      const compareEl = $('[data-compare-price]', this.root);

      if (!variant) {
        if (btn) { btn.disabled = true; btn.textContent = 'Unavailable'; }
        return;
      }
      if (idInput) idInput.value = variant.id;
      if (btn) { btn.disabled = !variant.available; btn.textContent = variant.available ? 'Add to Cart' : 'Sold Out'; }
      if (priceEl) priceEl.textContent = formatMoney(variant.price);
      if (compareEl) {
        const show = variant.compare_at_price && variant.compare_at_price > variant.price;
        compareEl.textContent = show ? formatMoney(variant.compare_at_price) : '';
        compareEl.classList.toggle('hidden', !show);
      }
      // Group gallery images by the color option value
      const color = (variant.option1 || '').toLowerCase();
      const thumbs = $$('[data-gallery-item]', this.root);
      if (thumbs.length) {
        let matched = false;
        thumbs.forEach((t) => {
          const alt = (t.dataset.imageGroup || '').toLowerCase();
          const show = !alt || alt.includes(color) || !color;
          t.classList.toggle('hidden', !show);
          if (show && !matched) { matched = true; this.setMain(t.dataset.imageSrc, t.dataset.imageAlt); }
        });
      }
      if (variant.featured_image) this.setMain(variant.featured_image.src, variant.featured_image.alt);
      // Keep the URL shareable
      if (history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        history.replaceState({}, '', url);
      }
    }
    setMain(src, alt) {
      const main = $('[data-main-image]', this.root);
      if (main && src) { main.src = src; main.alt = alt || ''; }
    }
  }
  $$('[data-variant-picker]').forEach((el) => new VariantPicker(el));

  /* ---------------- Gallery thumbnails ---------------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-gallery-item]');
    if (!t) return;
    const root = t.closest('[data-variant-picker]') || document;
    const main = $('[data-main-image]', root);
    if (main) { main.src = t.dataset.imageSrc; main.alt = t.dataset.imageAlt || ''; }
    $$('[data-gallery-item]', root).forEach((x) => x.classList.remove('ring-2', 'ring-gold'));
    t.classList.add('ring-2', 'ring-gold');
  });

  /* ---------------- Magnifying zoom ---------------- */
  $$('[data-zoom]').forEach((wrap) => {
    const img = $('img', wrap);
    if (!img) return;
    wrap.addEventListener('mouseenter', () => wrap.classList.add('is-zooming'));
    wrap.addEventListener('mouseleave', () => { wrap.classList.remove('is-zooming'); img.style.transformOrigin = 'center center'; });
    wrap.addEventListener('mousemove', (e) => {
      const r = wrap.getBoundingClientRect();
      img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    });
  });

  /* ---------------- FAQ accordion ---------------- */
  $$('[data-faq-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const panel = $('.faq-item__panel', item);
      const open = item.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.style.maxHeight = open ? panel.scrollHeight + 'px' : '0px';
    });
  });

  /* ---------------- Mobile menu + submenus ---------------- */
  $$('[data-submenu-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = btn.parentElement.querySelector('[data-submenu]');
      if (!panel) return;
      panel.classList.toggle('hidden');
      btn.classList.toggle('text-gold');
    });
  });

  /* ---------------- Newsletter (AJAX-styled feedback) ---------------- */
  $$('[data-newsletter-form]').forEach((form) => {
    form.addEventListener('submit', () => {
      const btn = $('button[type="submit"]', form);
      if (btn) { btn.disabled = true; btn.textContent = 'Subscribing…'; }
    });
  });

  /* ---------------- Scroll reveal ---------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
  $$('.reveal').forEach((el) => io.observe(el));

  /* ---------------- Sticky header ---------------- */
  const header = $('[data-header]');
  if (header) {
    let last = 0;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      header.classList.toggle('shadow-lg', y > 20);
      header.classList.toggle('backdrop-blur', y > 20);
      last = y;
    }, { passive: true });
  }

  /* ---------------- Smooth scroll for hash links ---------------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]:not([href="#"])');
    if (!a) return;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------------- Init ---------------- */
  document.addEventListener('DOMContentLoaded', refreshCart);
  window.LuxoraCart = { refreshCart, Cart, formatMoney, toast, openDrawer };
})();
