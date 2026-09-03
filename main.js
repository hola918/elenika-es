(function () {
  "use strict";
  /* ēlenika·ia — elenika.es
     Patrón IIFE clásico (sin ES modules). Contenido en HTML;
     el JS solo enriquece. Cada init va envuelto en safe(). */

  function safe(fn, name) {
    try { fn(); } catch (e) { console.warn("[" + name + "]", e); }
  }

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Splash (doble red de seguridad) ---------- */
  function initSplash() {
    var splash = document.querySelector("[data-splash]");
    if (!splash) return;

    /* Se salta el splash cuando no aporta nada: al volver de otra página del propio
       sitio (aviso legal, privacidad, cookies) o con prefers-reduced-motion.
       No usa cookies ni almacenamiento: solo mira de dónde viene la navegación. */
    var fromSameSite = document.referrer && document.referrer.indexOf(location.origin + "/") === 0;
    if (reduced || fromSameSite) { splash.remove(); return; }

    var hide = function () { splash.classList.add("is-out"); };
    if (document.readyState === "complete") setTimeout(hide, 400);
    else window.addEventListener("load", function () { setTimeout(hide, 300); });
    setTimeout(hide, 3500); // seguridad adicional (el CSS cubre 4,5 s)
  }

  /* ---------- Nav: transparente sobre hero, sólida al hacer scroll ---------- */
  function initNav() {
    var nav = document.querySelector("[data-nav]");
    if (!nav) return;
    var update = function () {
      var overHero = window.scrollY < 48;
      nav.classList.toggle("nav--overhero", overHero && !nav.classList.contains("nav--menu-open"));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });

    var burger = document.querySelector("[data-burger]");
    var links = document.querySelector("[data-nav-links]");
    if (burger && links) {
      burger.addEventListener("click", function () {
        var open = nav.classList.toggle("nav--menu-open");
        burger.setAttribute("aria-expanded", open ? "true" : "false");
        update();
      });
      links.addEventListener("click", function (e) {
        if (e.target.closest("a")) {
          nav.classList.remove("nav--menu-open");
          burger.setAttribute("aria-expanded", "false");
          update();
        }
      });
    }
  }

  /* ---------- Scroll suave para anclas (scroll nativo) ---------- */
  function initSmoothAnchors() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute("href");
      if (!id || id === "#") return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 82,
        behavior: reduced ? "auto" : "smooth"
      });
      // El salto puede adelantar al IntersectionObserver: fuerza el reveal de la
      // sección de destino durante el recorrido del scroll suave.
      if (typeof flushWideBurst === "function") flushWideBurst();
    });
  }

  /* ---------- Flush compartido: revela lo que ya está en viewport ----------
     Red de seguridad continua. El IntersectionObserver puede no emitir entrada cuando
     un elemento cruza el viewport entre dos frames (scroll rápido, salto de ancla,
     restauración de la posición de scroll al volver atrás). Este flush lo cubre.
       - normal  (scroll/resize): margen conservador; deja que el IO haga la entrada
         con su timing y solo rescata lo que se le escapa.
       - amplio  (saltos de ancla, carga, hashchange): revela TODO lo que hay en
         pantalla de golpe, para que un salto nunca deje una banda visible en blanco. */
  function flushInView(wide) {
    var limit = window.innerHeight * (wide ? 1.1 : 0.9);
    document.querySelectorAll(".reveal:not(.is-visible)").forEach(function (el) {
      if (el.getBoundingClientRect().top < limit) el.classList.add("is-visible");
    });
    document.querySelectorAll("[data-split]:not(.is-split-visible)").forEach(function (el) {
      if (el.getBoundingClientRect().top < limit) el.classList.add("is-split-visible");
    });
  }

  var flushScheduled = false;
  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    requestAnimationFrame(function () { flushScheduled = false; flushInView(false); });
  }

  // Tras un salto de ancla el scroll suave dura ~1 s: barre varias veces en ese tramo.
  function flushWideBurst() {
    [0, 120, 300, 600, 1000].forEach(function (t) {
      setTimeout(function () { flushInView(true); }, t);
    });
  }

  function initFlushSafetyNet() {
    window.addEventListener("scroll", scheduleFlush, { passive: true });
    window.addEventListener("resize", scheduleFlush, { passive: true });
    window.addEventListener("hashchange", flushWideBurst);
    window.addEventListener("load", function () { flushInView(true); });
    // Barridos tempranos por si el scroll inicial no dispara ningún evento.
    [200, 800, 2000].forEach(function (t) { setTimeout(function () { flushInView(true); }, t); });
  }

  /* ---------- Reveal on scroll (IO umbral bajo + flush continuo) ---------- */
  function initReveals() {
    var targets = document.querySelectorAll(".reveal:not([data-split])");
    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -2% 0px" });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Split words (preserva <br> y <em>) ---------- */
  function escHTML(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function splitWords(el) {
    el.setAttribute("aria-label", el.textContent.trim().replace(/\s+/g, " "));
    var wrap = function (text) {
      return text.split(/(\s+)/).map(function (w) {
        return /^\s+$/.test(w) ? w : '<span class="split-word" aria-hidden="true">' + escHTML(w) + "</span>";
      }).join("");
    };
    var html = Array.prototype.map.call(el.childNodes, function (node) {
      if (node.nodeType === 3) return wrap(node.textContent);
      if (node.nodeName === "BR") return "<br>";
      if (node.nodeType === 1) {
        var tag = node.tagName.toLowerCase();
        return "<" + tag + ">" + wrap(node.textContent) + "</" + tag + ">";
      }
      return "";
    }).join("");
    el.innerHTML = html;
    return el.querySelectorAll(".split-word");
  }

  function initSplitText() {
    var els = document.querySelectorAll("[data-split]");
    els.forEach(function (el) {
      if (el.dataset.splitBound) return; // idempotente
      el.dataset.splitBound = "1";
      if (el.classList.contains("reveal")) el.classList.remove("reveal");
      var words = splitWords(el);
      words.forEach(function (w, i) {
        w.style.transitionDelay = Math.min(i * 45, 600) + "ms";
      });
      var show = function () { el.classList.add("is-split-visible"); };
      if (!("IntersectionObserver" in window)) { show(); return; }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { show(); io.unobserve(el); }
        });
      }, { threshold: 0.01 });
      io.observe(el);
    });
  }

  /* ---------- Count-up en las cifras del hero ---------- */
  function fmtNum(n) {
    // Separador de millar es-ES también en cifras de 4 dígitos (1.000)
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function initCountUp() {
    var els = document.querySelectorAll("[data-count]");
    if (!els.length) return;
    var animate = function (el) {
      var target = parseInt(el.dataset.count, 10) || 0;
      if (reduced) { el.textContent = fmtNum(target); return; }
      var t0 = null;
      var dur = 1400;
      var step = function (t) {
        if (!t0) t0 = t;
        var p = Math.min((t - t0) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmtNum(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.textContent = fmtNum(parseInt(el.dataset.count, 10) || 0); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { animate(entry.target); io.unobserve(entry.target); }
      });
    }, { threshold: 0.01 });
    els.forEach(function (el) { io.observe(el); });
    setTimeout(function () {
      els.forEach(function (el) {
        if (!/\d\d/.test(el.textContent)) el.textContent = fmtNum(parseInt(el.dataset.count, 10) || 0);
      });
    }, 6000);
  }

  /* ---------- Parallax sutil en imágenes editoriales (GSAP) ---------- */
  function initParallax() {
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    document.querySelectorAll("[data-parallax]").forEach(function (fig) {
      var img = fig.querySelector("img");
      if (!img) return;
      var amount = parseFloat(fig.dataset.parallax) || 0.1;
      gsap.fromTo(img,
        { yPercent: -amount * 50 },
        {
          yPercent: amount * 50,
          ease: "none",
          scrollTrigger: { trigger: fig, start: "top bottom", end: "bottom top", scrub: 0.6 }
        }
      );
    });
  }

  /* ---------- CTA magnético (naranja) — solo con puntero fino ---------- */
  function initMagnetic() {
    if (matchMedia("(hover: none)").matches) return;
    document.querySelectorAll("[data-magnetic]").forEach(function (btn) {
      if (btn.dataset.magneticBound) return; // idempotente
      btn.dataset.magneticBound = "1";
      var strength = 18;
      btn.addEventListener("mousemove", function (e) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
        var y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        btn.style.transform = "translate(" + x * strength * 0.4 + "px, " + (y * strength * 0.35 - 2) + "px)";
      });
      btn.addEventListener("mouseout", function (e) {
        if (btn.contains(e.relatedTarget)) return;
        btn.style.transform = "";
      });
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    safe(initSplash, "initSplash");
    safe(initNav, "initNav");
    safe(initSmoothAnchors, "initSmoothAnchors");
    safe(initSplitText, "initSplitText");
    safe(initReveals, "initReveals");
    safe(initFlushSafetyNet, "initFlushSafetyNet");
    safe(initCountUp, "initCountUp");
    safe(initParallax, "initParallax");
    safe(initMagnetic, "initMagnetic");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
