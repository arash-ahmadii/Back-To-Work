document.addEventListener('DOMContentLoaded', () => {
  const modeLabel = document.getElementById('modeLabel');
  const modeDot = document.getElementById('modeDot');
  const sitesContainer = document.getElementById('sites');
  const openOptions = document.getElementById('openOptions');
  const modeSwitch = document.getElementById('modeSwitch');
  const todayMinutesEl = document.getElementById('todayMinutes');
  const modePresetLabel = document.getElementById('modePresetLabel');
  const modePresetDesc = document.getElementById('modePresetDesc');

  const presetMeta = {
    work_only: {
      label: 'Work only',
      desc: 'Treat today as pure work time. Stranger sites are strongly limited.'
    },
    normal_day: {
      label: 'Normal day',
      desc: 'Follow your work schedule with moderate friction on non-work sites.'
    },
    low_focus: {
      label: 'Low focus',
      desc: 'Keep the schedule, but with softer, more forgiving nudges.'
    },
    no_work: {
      label: 'No work today',
      desc: 'Take a day off. Work rules are relaxed, logging continues.'
    },
    auto: {
      label: 'Automatic',
      desc: 'Let Back To Work decide based on your schedule.'
    }
  };

  if (openOptions) {
    openOptions.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options.html'));
      }
    });
  }

  if (modeSwitch) {
    modeSwitch.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest('button[data-mode]');
      if (!button || !modeSwitch.contains(button)) return;
      const mode = button.getAttribute('data-mode');
      if (!mode) return;
      modeSwitch.querySelectorAll('button[data-mode]').forEach((b) => {
        b.classList.toggle('is-active', b.getAttribute('data-mode') === mode);
      });
      const meta = presetMeta[mode];
      if (meta && modePresetLabel && modePresetDesc) {
        modePresetLabel.textContent = meta.label;
        modePresetDesc.textContent = meta.desc;
      }
      chrome.runtime.sendMessage({ type: 'SET_MODE_PRESET', value: mode }, () => {
        if (chrome.runtime.lastError) {
          return;
        }
      });
    });
  }

  function refreshState() {
    chrome.storage.local.get(['ti_settings', 'ti_stats', 'ti_mode_preset'], (stored) => {
      const settings = stored.ti_settings || {};
      const stats = stored.ti_stats || {};
      const preset = stored.ti_mode_preset || 'auto';

      const now = new Date();
      const mode = getCurrentMode(now, settings.workSchedule);

      if (mode && modeLabel && modeDot) {
        modeLabel.textContent =
          mode === 'work'
            ? 'Professional You · Work mode'
            : 'Free You · Free mode';
        modeDot.style.backgroundColor = mode === 'work' ? '#22c55e' : '#fbbf24';
      }

      const todayKey = getDateKey(now);
      const todayStats = stats[todayKey] || {};
      const minutes = todayStats.productiveMs ? Math.floor(todayStats.productiveMs / 60000) : 0;
      if (todayMinutesEl) {
        todayMinutesEl.textContent = String(minutes);
      }

      if (settings && Array.isArray(settings.workSites) && sitesContainer) {
        sitesContainer.innerHTML = '';
        if (settings.workSites.length === 0) {
          sitesContainer.textContent = 'No work sites configured yet.';
        } else {
          settings.workSites.forEach((domain) => {
            const span = document.createElement('span');
            span.className = 'chip';
            span.textContent = domain;
            sitesContainer.appendChild(span);
          });
        }
      }

      const effectivePreset = preset || 'auto';

      if (modeSwitch && effectivePreset) {
        const buttons = modeSwitch.querySelectorAll('button[data-mode]');
        buttons.forEach((button) => {
          const value = button.getAttribute('data-mode');
          if (!value) return;
          const isActive = effectivePreset === value;
          if (isActive) {
            button.classList.add('is-active');
          } else {
            button.classList.remove('is-active');
          }
        });
      }

      const meta = presetMeta[effectivePreset];
      if (meta && modePresetLabel && modePresetDesc) {
        modePresetLabel.textContent = meta.label;
        modePresetDesc.textContent = meta.desc;
      }
    });
  }

  refreshState();
  setInterval(refreshState, 15000);
});

function getCurrentMode(now, workSchedule) {
  if (!workSchedule || !workSchedule.perDay) {
    const day = now.getDay();
    const hour = now.getHours();
    const days = Array.isArray(workSchedule?.days) ? workSchedule.days : [1, 2, 3, 4, 5];
    const startHour = typeof workSchedule?.startHour === 'number' ? workSchedule.startHour : 9;
    const endHour = typeof workSchedule?.endHour === 'number' ? workSchedule.endHour : 13;
    const isWorkDay = days.includes(day);
    const inWorkHours = hour >= startHour && hour < endHour;
    return isWorkDay && inWorkHours ? 'work' : 'free';
  }
  const day = now.getDay();
  const hour = now.getHours();
  const cfg = workSchedule.perDay[day];
  if (!cfg || !cfg.enabled) return 'free';
  const startHour = typeof cfg.startHour === 'number' ? cfg.startHour : 9;
  const endHour = typeof cfg.endHour === 'number' ? cfg.endHour : 13;
  const inWorkHours = hour >= startHour && hour < endHour;
  return inWorkHours ? 'work' : 'free';
}

function getDateKey(now) {
  return now.toISOString().slice(0, 10);
}
