const STORAGE_KEY_SETTINGS = 'ti_settings';

const DEFAULT_SETTINGS = {
  workSites: ['github.com', 'stackoverflow.com', 'notion.so'],
  workSchedule: {
    perDay: {
      0: { enabled: false, startHour: 9, endHour: 13 },
      1: { enabled: true, startHour: 9, endHour: 13 },
      2: { enabled: true, startHour: 9, endHour: 13 },
      3: { enabled: true, startHour: 9, endHour: 13 },
      4: { enabled: true, startHour: 9, endHour: 13 },
      5: { enabled: true, startHour: 9, endHour: 13 },
      6: { enabled: false, startHour: 9, endHour: 13 }
    }
  },
  friction: {
    workOnNonWorkSite: 'medium',
    freeMode: 'none'
  },
  humorPercent: 40
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settingsForm');
  const workSitesInput = document.getElementById('workSites');
  const statusEl = document.getElementById('status');
  const humorInput = document.getElementById('humorPercent');
  const humorLabel = document.getElementById('humorLabel');

  if (!form || !workSitesInput || !statusEl || !humorInput || !humorLabel) {
    return;
  }

  loadSettings();

  humorInput.addEventListener('input', () => {
    updateHumorLabel(parseInt(humorInput.value, 10), humorLabel);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusEl.textContent = '';

    const workSites = workSitesInput.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const perDay = {};
    for (let day = 0; day < 7; day += 1) {
      const toggle = document.querySelector(`[data-day-toggle="${day}"]`);
      const startInput = document.querySelector(`[data-start-hour="${day}"]`);
      const endInput = document.querySelector(`[data-end-hour="${day}"]`);
      if (!toggle || !startInput || !endInput) {
        continue;
      }
      const enabled = toggle.checked;
      const startHour = clampNumber(parseInt(startInput.value, 10), 0, 23, 9);
      const endHour = clampNumber(parseInt(endInput.value, 10), 0, 23, 13);
      perDay[day] = { enabled, startHour, endHour };
    }

    const humorPercent = clampNumber(parseInt(humorInput.value, 10), 0, 100, 40);

    const newSettings = {
      ...DEFAULT_SETTINGS,
      workSites,
      workSchedule: {
        perDay
      },
      friction: {
        ...DEFAULT_SETTINGS.friction
      },
      humorPercent
    };

    await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: newSettings });
    statusEl.textContent = 'Settings saved.';
    chrome.runtime.sendMessage({ type: 'REFRESH_ACTIVE_POLICY' }, () => {
      if (chrome.runtime.lastError) {
        return;
      }
    });
    setTimeout(() => {
      statusEl.textContent = '';
    }, 2500);
  });

  async function loadSettings() {
    const stored = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
    const settings = stored[STORAGE_KEY_SETTINGS] || DEFAULT_SETTINGS;
    workSitesInput.value = (settings.workSites || []).join('\n');
    const schedule = normalizeSchedule(settings.workSchedule);
    for (let day = 0; day < 7; day += 1) {
      const cfg = schedule.perDay[day];
      const toggle = document.querySelector(`[data-day-toggle="${day}"]`);
      const startInput = document.querySelector(`[data-start-hour="${day}"]`);
      const endInput = document.querySelector(`[data-end-hour="${day}"]`);
      if (!toggle || !startInput || !endInput) continue;
      toggle.checked = cfg.enabled;
      startInput.value = cfg.startHour;
      endInput.value = cfg.endHour;
    }
    const humorPercent = typeof settings.humorPercent === 'number' ? settings.humorPercent : DEFAULT_SETTINGS.humorPercent;
    humorInput.value = String(humorPercent);
    updateHumorLabel(humorPercent, humorLabel);
  }
});

function clampNumber(value, min, max, fallback) {
  if (Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeSchedule(schedule) {
  if (!schedule) return DEFAULT_SETTINGS.workSchedule;
  if (schedule.perDay) {
    const perDay = {};
    for (let day = 0; day < 7; day += 1) {
      const cfg = schedule.perDay[day];
      if (cfg) {
        perDay[day] = {
          enabled: Boolean(cfg.enabled),
          startHour: clampNumber(parseInt(cfg.startHour, 10), 0, 23, 9),
          endHour: clampNumber(parseInt(cfg.endHour, 10), 0, 23, 13)
        };
      } else {
        perDay[day] = DEFAULT_SETTINGS.workSchedule.perDay[day];
      }
    }
    return { perDay };
  }
  const days = Array.isArray(schedule.days) ? schedule.days : DEFAULT_SETTINGS.workSchedule.days || [1, 2, 3, 4, 5];
  const startHour = clampNumber(parseInt(schedule.startHour, 10), 0, 23, 9);
  const endHour = clampNumber(parseInt(schedule.endHour, 10), 0, 23, 13);
  const perDay = {};
  for (let day = 0; day < 7; day += 1) {
    const enabled = days.includes(day);
    perDay[day] = { enabled, startHour, endHour };
  }
  return { perDay };
}

function updateHumorLabel(value, labelEl) {
  if (!labelEl) return;
  if (value <= 10) {
    labelEl.textContent = 'Very serious';
  } else if (value <= 35) {
    labelEl.textContent = 'Mostly serious';
  } else if (value <= 65) {
    labelEl.textContent = 'Balanced';
  } else if (value <= 90) {
    labelEl.textContent = 'Playful';
  } else {
    labelEl.textContent = 'Very playful';
  }
}

