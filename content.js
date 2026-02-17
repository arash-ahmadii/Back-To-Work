const OVERLAY_ID = 'ti-focus-toast';
const STYLE_ID = 'ti-focus-style';
const BODY_CLASS_GRAYSCALE = 'ti-focus-grayscale';

let lastFrictionLevel = 'none';
let mildPromptTimer = null;
let messageRotationIndex = Math.floor(Math.random() * 500);
let currentStrongStage = -1;
let strongScrollHandlerAttached = false;
let strongClickHandlerAttached = false;
let toastRefreshParams = null;

const MESSAGES_MILD = [
  'You are currently in Work Mode.',
  'This site is outside your work list.',
  'Consider returning to your task.',
  'Focus session is active.',
  'Drift detected.',
  'Your scheduled time is running.',
  'Stay aligned with your goals.',
  'Work identity is enabled.',
  'This may reduce your focus time.',
  'Return to priority tasks.',
  'Deep Work is active.',
  'You set this boundary intentionally.',
  'Respect your structure.',
  'Time awareness enabled.',
  'Realign with your objectives.',
  'Stay disciplined.',
  'Your goals require attention.',
  'Focus protects your progress.',
  'This session is being tracked.',
  'Consider switching context.',
  'Productive hours are limited.',
  'You chose structure today.',
  'Stay intentional.',
  'Continue building.',
  'Your time is valuable.',
  'This isn’t part of your work mode.',
  'Return to your active project.',
  'Stay consistent.',
  'Keep your commitments.',
  'Focus window open.',
  'Drift threshold approaching.',
  'Work session ongoing.',
  'Realign with your plan.',
  'Productivity is active.',
  'This may interrupt your momentum.',
  'Maintain your structure.',
  'Your goals matter.',
  'Stay present.',
  'Continue your progress.',
  'Focus mode reminder.',
  'This is outside your defined goals.',
  'Respect your schedule.',
  'Deep focus is scheduled now.',
  'You are in Professional Mode.',
  'Consider returning to work.',
  'Stay aligned.',
  'Keep your momentum steady.',
  'This hour counts.',
  'Protect your time.',
  'Back to focus.'
];

const MESSAGES_FUNNY = [
  'Quick question: is this helping you?',
  'That task is still waiting politely.',
  'Your schedule remembers.',
  'Five more minutes? Sure… liar.',
  'You said “just one video.”',
  'That deadline didn’t move.',
  'Your focus just left the building.',
  'This tab is optional. Your goals aren’t.',
  'Small scrolls become big regrets.',
  'You can do better than this click.',
  'This isn’t building your future.',
  'Your ambition deserves better.',
  'That email won’t send itself.',
  'Maybe switch to the work tab?',
  'This isn’t urgent.',
  'Your time is valuable.',
  'Focus looks good on you.',
  'This won’t show up on your paycheck.',
  'Your goals are still open somewhere.',
  'Work now, scroll later.',
  'That raise requires effort.',
  'You didn’t open your laptop for this.',
  'Momentum starts with one decision.',
  'This won’t age well.',
  'You’re capable of more.',
  'The grind is quiet but powerful.',
  'Don’t ghost your goals.',
  'Your future self says hi.',
  'Maybe close this?',
  'Just a reminder.',
  'This might cost you time.',
  'You set this schedule for a reason.',
  'Your focus window is active.',
  'This isn’t aligned with your plan.',
  'Stay intentional.',
  'You’ve got this.',
  'Back to building.',
  'Make this hour count.',
  'Choose progress.',
  'Close the tab, win the hour.',
  'Your plan matters.',
  'Stay on track.',
  'Keep your momentum.',
  'That task needs you.',
  'This can wait.',
  'Discipline feels better later.',
  'Respect your schedule.',
  'Stay consistent.',
  'Focus mode is on.',
  'Back to work.'
];

const MESSAGES_VERY_FUNNY = [
  'Even penguins clock in. Just saying.',
  'If you dodge work any harder, your paycheck will dodge you back.',
  'Somewhere, a spreadsheet is waiting for you like a sad puppy.',
  'You scroll like rent isn’t due. Bold.',
  'If procrastination were cardio, you’d qualify for the Olympics.',
  'Your bank account just whispered, “please.”',
  'This tab won’t pay your electric bill. Darkness will.',
  'NASA called. They said this isn’t a launch sequence.',
  'If this were productive, your chair would clap. It didn’t.',
  'You’re avoiding work like it’s a group project.',
  'If you keep this up, your salary might ghost you.',
  'Even sloths move with purpose sometimes.',
  'Your to-do list just updated its will.',
  'This scroll is sponsored by Regret™.',
  'If excuses were currency, you’d be a billionaire.',
  'Your future self just filed a noise complaint.',
  'That deadline is aging like milk.',
  'Bro. The bills are watching.',
  'Your ambition is buffering.',
  'You’re moving your mouse like it owes you money.',
  'If scrolling built muscle, you’d be jacked.',
  'That task didn’t disappear. It’s hiding behind this tab.',
  'Even your Wi-Fi is embarrassed.',
  'You’re procrastinating like it’s a side hustle.',
  'The grind just unfollowed you.',
  'This is not “research.” This is chaos with Wi-Fi.',
  'Your coffee didn’t die for this.',
  'That promotion isn’t hiding here.',
  'If this were helpful, it’d have a salary.',
  'You’re scrolling like you’ve already retired.',
  'Your wallet just fainted.',
  'This is how legends… stay average.',
  'The deadline just texted: “wyd?”',
  'Your ambition is side-eyeing you.',
  'If vibes paid bills, you’d be good. They don’t.',
  'You didn’t wake up for this nonsense.',
  'Even pigeons hustle.',
  'Your bank app is sweating.',
  'This is not CEO energy.',
  'Okay comedian, now back to work.',
  'Your dreams are in another tab crying softly.',
  'This tab is giving “unemployed behavior.”',
  'You’re speed-running disappointment.',
  'That project is collecting dust and emotional damage.',
  'The algorithm loves you. Your career? Not so much.',
  'If laziness had a soundtrack, this would be it.',
  'Close this before your goals change their mind.',
  'Even squirrels prepare for winter.',
  'Your rent is not impressed.',
  'This scroll has zero ROI.',
  'You’re procrastinating like it’s performance art.'
];

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'APPLY_POLICY') return;
  const {
    mode,
    isWorkSite,
    hostname,
    frictionLevel,
    intensityStage,
    humorPercent,
    textSeverity
  } = message.payload || {};
  applyFriction({
    mode,
    isWorkSite,
    hostname,
    frictionLevel,
    intensityStage,
    humorPercent,
    textSeverity
  });
});

function startPolling() {
  function poll() {
    try {
      chrome.runtime.sendMessage({ type: 'POLL_POLICY' }, () => {});
    } catch (e) {
    }
  }
  poll();
  setInterval(poll, 15000);
}

startPolling();

function ensureBaseStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html.${BODY_CLASS_GRAYSCALE} {
      filter: grayscale(1) brightness(0.9);
      transition: filter 0.25s ease;
    }

    #${OVERLAY_ID} {
      position: fixed;
      left: 12px;
      bottom: 12px;
      max-width: 320px;
      z-index: 999999;
      pointer-events: none;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.2s ease, transform 0.2s ease;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    }

    #${OVERLAY_ID}.ti-visible {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    #${OVERLAY_ID} .ti-panel {
      background: rgba(15, 23, 42, 0.96);
      color: #f5f5f7;
      border-radius: 10px;
      padding: 10px 12px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(148, 163, 184, 0.5);
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    #${OVERLAY_ID} .ti-title {
      font-size: 12px;
      font-weight: 600;
    }

    #${OVERLAY_ID} .ti-subtitle {
      font-size: 11px;
      color: #d1d5db;
    }

    #${OVERLAY_ID} .ti-actions {
      margin-top: 6px;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    #${OVERLAY_ID} button {
      all: unset;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 11px;
      cursor: pointer;
      border: 1px solid rgba(148, 163, 184, 0.6);
      color: #e5e7eb;
      background: rgba(15, 23, 42, 0.9);
    }

    #${OVERLAY_ID} button.ti-primary {
      background: #2563eb;
      border-color: #2563eb;
      color: #f9fafb;
    }

    html.ti-strong-blur img,
    html.ti-strong-blur video {
      filter: blur(2px);
    }

    html.ti-strong-tilt body * {
      transition: transform 0.2s ease;
    }

    html.ti-strong-tilt body:hover * {
      transform: translateY(-1px);
    }

    html.ti-strong-distort body {
      letter-spacing: 0.06em;
      text-shadow: 0 0 1px rgba(15, 23, 42, 0.8);
    }

    html.ti-strong-hide-suggestions [class*="sidebar"],
    html.ti-strong-hide-suggestions [id*="sidebar"],
    html.ti-strong-hide-suggestions [class*="recommend"],
    html.ti-strong-hide-suggestions [class*="suggest"] {
      opacity: 0.12;
      transition: opacity 0.3s ease;
    }
  `;
  document.documentElement.appendChild(style);
}

function getOrCreateOverlay() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = `
    <div class="ti-panel" role="alert">
      <div class="ti-title">Back To Work</div>
      <div class="ti-subtitle">
        You are in work mode. Do you really want to stay here right now?
      </div>
      <div class="ti-actions">
        <button type="button" data-action="back">Back to work</button>
        <button type="button" class="ti-primary" data-action="stay">Stay here</button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute('data-action');
    if (!action) return;
    if (action === 'back') {
      hideOverlay();
      window.history.back();
    } else if (action === 'stay') {
      hideOverlay();
    }
  });

  document.documentElement.appendChild(overlay);
  return overlay;
}

function pickMessage(humorPercent, intensityStage) {
  const h = typeof humorPercent === 'number' ? humorPercent : 50;
  let weights;
  if (h <= 30) {
    weights = { mild: 0.7, funny: 0.3, very: 0 };
  } else if (h >= 70) {
    weights = { mild: 0.1, funny: 0.5, very: 0.4 };
  } else {
    weights = { mild: 0.4, funny: 0.4, very: 0.2 };
  }
  if (intensityStage >= 4) {
    weights.very += 0.2;
    weights.funny += 0.1;
    weights.mild = Math.max(0, 1 - (weights.funny + weights.very));
  }
  const r = Math.random();
  let pool;
  if (r < weights.mild) {
    pool = MESSAGES_MILD;
  } else if (r < weights.mild + weights.funny) {
    pool = MESSAGES_FUNNY;
  } else {
    pool = MESSAGES_VERY_FUNNY;
  }
  if (!pool.length) return '';
  const idx = messageRotationIndex % pool.length;
  messageRotationIndex += 1;
  return pool[idx];
}

function pickMildSubtitle(hostname, humorPercent, intensityStage) {
  const base = pickMessage(humorPercent, intensityStage);
  const name = hostname || 'this site';
  return (base || 'You are in work mode. Do you really want to stay on this site?').replace(
    'this site',
    name
  );
}

function showOverlay(mode, hostname, subtitleText) {
  ensureBaseStyle();
  const overlay = getOrCreateOverlay();
  const titleEl = overlay.querySelector('.ti-title');
  const subtitleEl = overlay.querySelector('.ti-subtitle');
  if (titleEl) {
    titleEl.textContent = mode === 'work' ? 'Back To Work' : 'Focus check-in';
  }
  if (subtitleEl) {
    const name = hostname || 'this site';
    subtitleEl.textContent =
      subtitleText || `You are in work mode. Do you really want to stay on ${name} right now?`;
  }
  overlay.classList.add('ti-visible');
}

function hideOverlay() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    overlay.classList.remove('ti-visible');
  }
}

function applyFriction({
  mode,
  isWorkSite,
  hostname,
  frictionLevel,
  intensityStage,
  humorPercent,
  textSeverity
}) {
  ensureBaseStyle();

  if (!mode || mode !== 'work' || isWorkSite) {
    lastFrictionLevel = 'none';
    clearFriction();
    return;
  }

  function startToastRefreshTimer() {
    if (mildPromptTimer) {
      clearInterval(mildPromptTimer);
      mildPromptTimer = null;
    }
    mildPromptTimer = setInterval(() => {
      if (toastRefreshParams) {
        const { mode: m, hostname: h, humorPercent: hp, intensityStage: is } = toastRefreshParams;
        const nextSubtitle = pickMildSubtitle(h, hp, is);
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) {
          const subtitleEl = overlay.querySelector('.ti-subtitle');
          if (subtitleEl) subtitleEl.textContent = nextSubtitle || subtitleEl.textContent;
        }
      }
    }, 40000);
  }

  if (frictionLevel === 'mild') {
    document.documentElement.classList.remove(BODY_CLASS_GRAYSCALE);
    toastRefreshParams = { mode, hostname, humorPercent, intensityStage };
    if (lastFrictionLevel !== 'mild') {
      const subtitle = pickMildSubtitle(hostname, humorPercent, intensityStage);
      showOverlay(mode, hostname, subtitle);
      startToastRefreshTimer();
    }
    lastFrictionLevel = 'mild';
  } else if (frictionLevel === 'medium') {
    document.documentElement.classList.add(BODY_CLASS_GRAYSCALE);
    toastRefreshParams = { mode, hostname, humorPercent, intensityStage };
    if (lastFrictionLevel !== 'medium') {
      const subtitle = pickMildSubtitle(hostname, humorPercent, intensityStage);
      showOverlay(mode, hostname, subtitle);
      startToastRefreshTimer();
    }
    lastFrictionLevel = 'medium';
  } else if (frictionLevel === 'strong') {
    applyStrongEffects(mode, hostname, intensityStage, humorPercent, lastFrictionLevel === 'strong');
    lastFrictionLevel = 'strong';
  } else {
    lastFrictionLevel = 'none';
    toastRefreshParams = null;
    if (mildPromptTimer) {
      clearInterval(mildPromptTimer);
      mildPromptTimer = null;
    }
    document.body.style.pointerEvents = '';
    clearFriction();
  }
}

function clearFriction() {
  toastRefreshParams = null;
  if (mildPromptTimer) {
    clearInterval(mildPromptTimer);
    mildPromptTimer = null;
  }
  document.documentElement.classList.remove(BODY_CLASS_GRAYSCALE);
  document.documentElement.classList.remove('ti-strong-blur');
  document.documentElement.classList.remove('ti-strong-tilt');
  document.documentElement.classList.remove('ti-strong-distort');
  document.documentElement.classList.remove('ti-strong-hide-suggestions');
  document.body.style.pointerEvents = '';
  detachStrongHandlers();
  hideOverlay();
}

function applyStrongEffects(mode, hostname, intensityStage, humorPercent, skipOverlayAndTimer) {
  ensureBaseStyle();
  document.documentElement.classList.add(BODY_CLASS_GRAYSCALE);
  currentStrongStage = typeof intensityStage === 'number' ? intensityStage : 0;
  toastRefreshParams = { mode, hostname, humorPercent, intensityStage };

  if (currentStrongStage >= 1 && !skipOverlayAndTimer) {
    const subtitle = pickMildSubtitle(hostname, humorPercent, intensityStage);
    showOverlay(mode, hostname, subtitle);
    if (mildPromptTimer) {
      clearInterval(mildPromptTimer);
      mildPromptTimer = null;
    }
    mildPromptTimer = setInterval(() => {
      if (toastRefreshParams) {
        const { mode: m, hostname: h, humorPercent: hp, intensityStage: is } = toastRefreshParams;
        const nextSubtitle = pickMildSubtitle(h, hp, is);
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) {
          const subtitleEl = overlay.querySelector('.ti-subtitle');
          if (subtitleEl) subtitleEl.textContent = nextSubtitle || subtitleEl.textContent;
        }
      }
    }, 40000);
  }

  if (currentStrongStage >= 2) {
    document.documentElement.classList.add('ti-strong-blur');
  }

  if (currentStrongStage >= 3) {
    document.documentElement.classList.add('ti-strong-hide-suggestions');
  }

  if (currentStrongStage >= 4) {
    document.documentElement.classList.add('ti-strong-tilt');
  }

  if (currentStrongStage >= 5) {
    document.documentElement.classList.add('ti-strong-distort');
  }

  if (currentStrongStage >= 6) {
    attachStrongScrollHandler();
  }

  if (currentStrongStage >= 8) {
    attachStrongClickHandler();
  }

  if (currentStrongStage >= 10) {
    document.body.style.pointerEvents = 'none';
  }
}

function attachStrongScrollHandler() {
  if (strongScrollHandlerAttached) return;
  strongScrollHandlerAttached = true;
  window.addEventListener(
    'wheel',
    (event) => {
      if (currentStrongStage < 6) return;
      event.preventDefault();
      const factor = currentStrongStage >= 7 ? -0.5 : -0.25;
      const delta = event.deltaY * factor;
      window.scrollBy(0, delta);
    },
    { passive: false }
  );
}

function attachStrongClickHandler() {
  if (strongClickHandlerAttached) return;
  strongClickHandlerAttached = true;
  document.addEventListener(
    'click',
    (event) => {
      if (currentStrongStage < 8) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const rect = target.getBoundingClientRect();
      const offsetX = rect.width * 0.3;
      const offsetY = rect.height * 0.3;
      const x = rect.left + offsetX;
      const y = rect.top + offsetY;
      const other = document.elementFromPoint(x, y);
      if (!other || other === target) return;
      event.preventDefault();
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
      });
      other.dispatchEvent(clickEvent);
    },
    true
  );
}

function detachStrongHandlers() {
  if (strongScrollHandlerAttached || strongClickHandlerAttached) {
    window.onwheel = window.onwheel;
    document.onclick = document.onclick;
    strongScrollHandlerAttached = false;
    strongClickHandlerAttached = false;
  }
  currentStrongStage = -1;
}

