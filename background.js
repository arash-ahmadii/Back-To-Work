const STORAGE_KEY_SETTINGS = 'ti_settings';
const STORAGE_KEY_STATS = 'ti_stats';
const STORAGE_KEY_MODE_PRESET = 'ti_mode_preset';
const WEEKLY_RESET_ALARM = 'ti_weekly_reset';
const MODE_TICK_ALARM = 'ti_mode_tick';

const MODE_PRESET_CONFIG = {
  work_only: {
    graceMinutes: 2,
    softLimitMinutes: 7,
    hardLimitMinutes: 7
  },
  normal_day: {
    graceMinutes: 3,
    softLimitMinutes: 10,
    hardLimitMinutes: 20
  },
  low_focus: {
    graceMinutes: 5,
    softLimitMinutes: 15,
    hardLimitMinutes: 30
  },
  no_work: {
    graceMinutes: 30,
    softLimitMinutes: 30,
    hardLimitMinutes: 30
  },
  auto: {
    graceMinutes: 3,
    softLimitMinutes: 10,
    hardLimitMinutes: 20
  }
};

const DEFAULT_SETTINGS = {
  workSites: ['github.com', 'stackoverflow.com', 'notion.so'],
  workSchedule: {
    startHour: 9,
    endHour: 13,
    days: [1, 2, 3, 4, 5]
  },
  friction: {
    workOnNonWorkSite: 'medium',
    freeMode: 'none'
  }
};

let lastSample = null;

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
  if (!stored[STORAGE_KEY_SETTINGS]) {
    await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: DEFAULT_SETTINGS });
  }

  chrome.alarms.create(WEEKLY_RESET_ALARM, {
    periodInMinutes: 7 * 24 * 60
  });

  chrome.alarms.create(MODE_TICK_ALARM, {
    periodInMinutes: 0.5
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(MODE_TICK_ALARM, {
    periodInMinutes: 0.5
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === WEEKLY_RESET_ALARM) {
    await chrome.storage.local.set({ [STORAGE_KEY_STATS]: {} });
  } else if (alarm.name === MODE_TICK_ALARM) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id && tab.url) {
      await applyPolicyForTab(tab);
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    await applyPolicyForTab(tab);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab && tab.url) {
    await applyPolicyForTab(tab);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GET_STATE') {
    handleGetStateRequest().then(sendResponse);
    return true;
  }
  if (message?.type === 'SET_MODE_PRESET') {
    handleSetModePreset(message.value).then(sendResponse);
    return true;
  }
  if (message?.type === 'REFRESH_ACTIVE_POLICY') {
    handleRefreshActivePolicy().then(sendResponse);
    return true;
  }
  if (message?.type === 'POLL_POLICY') {
    if (sender.tab) {
      applyPolicyForTab(sender.tab);
      sendResponse({ ok: true });
      return true;
    }
  }
  return false;
});

async function handleGetStateRequest() {
  const settings = await getSettings();
  const now = new Date();
  const modeInfo = await getEffectiveMode(now, settings.workSchedule);
  const stats = await getTodayStats(now);
  return {
    mode: modeInfo.mode,
    baseMode: modeInfo.baseMode,
    modePreset: modeInfo.preset,
    settings,
    todayProductiveMinutes: Math.floor((stats.productiveMs || 0) / 60000)
  };
}

async function handleSetModePreset(value) {
  const allowed = ['work_only', 'normal_day', 'low_focus', 'no_work', 'auto'];
  if (!allowed.includes(value)) return { ok: false };
  await chrome.storage.local.set({ [STORAGE_KEY_MODE_PRESET]: value });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id && tab.url) {
    await applyPolicyForTab(tab);
  }
  return { ok: true };
}

async function handleRefreshActivePolicy() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id && tab.url) {
    await applyPolicyForTab(tab);
  }
  return { ok: true };
}

async function getSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
  return stored[STORAGE_KEY_SETTINGS] || DEFAULT_SETTINGS;
}

function getModeFromSchedule(now, workSchedule) {
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

async function getEffectiveMode(now, workSchedule) {
  const baseMode = getModeFromSchedule(now, workSchedule);
  const stored = await chrome.storage.local.get(STORAGE_KEY_MODE_PRESET);
  const preset = stored[STORAGE_KEY_MODE_PRESET] || 'auto';
  let mode = baseMode;
  if (preset === 'work_only') {
    mode = 'work';
  } else if (preset === 'no_work') {
    mode = 'free';
  } else if (preset === 'low_focus') {
    mode = baseMode;
  } else if (preset === 'normal_day' || preset === 'auto') {
    mode = baseMode;
  }
  return { mode, baseMode, preset };
}

function isHttpUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function getHostname(url) {
  try {
    const u = new URL(url);
    return u.hostname || '';
  } catch {
    return '';
  }
}

async function applyPolicyForTab(tab) {
  if (!tab.id || !tab.url || !isHttpUrl(tab.url)) return;

  const settings = await getSettings();
  const now = new Date();
  const modeInfo = await getEffectiveMode(now, settings.workSchedule);
  const mode = modeInfo.mode;
  const preset = modeInfo.preset;
  const hostname = getHostname(tab.url);

  const isWorkSite = settings.workSites.some((domain) =>
    hostname === domain || hostname.endsWith('.' + domain)
  );

  await updateTimeStats(now, mode, isWorkSite, hostname, preset);

  const config = MODE_PRESET_CONFIG[preset] || MODE_PRESET_CONFIG.auto;
  const graceMinutes = config.graceMinutes;
  const softLimitMinutes = config.softLimitMinutes;
  const hardLimitMinutes = config.hardLimitMinutes;
  const stats = await getTodayStats(now);
  const modeBucket = stats.strangerByMode && stats.strangerByMode[preset] ? stats.strangerByMode[preset] : {};
  const hostMs = modeBucket[hostname] || 0;
  const hostMinutes = Math.floor(hostMs / 60000);

  let frictionLevel = 'none';
  let textSeverity = 'none';
  let intensityStage = 0;
  if (mode === 'work' && !isWorkSite && preset !== 'no_work') {
    const graceMs = graceMinutes * 60000;
    const overMs = Math.max(0, hostMs - graceMs);
    intensityStage = Math.floor(overMs / 15000); // every 15s after grace

    if (intensityStage <= 0) {
      frictionLevel = 'none';
      textSeverity = 'none';
    } else if (intensityStage <= 3) {
      frictionLevel = 'mild';
      textSeverity = 'soft';
    } else if (intensityStage <= 8) {
      frictionLevel = 'medium';
      textSeverity = 'soft';
    } else {
      frictionLevel = 'strong';
      textSeverity = 'hard';
    }
  }

  const payload = {
    mode,
    frictionLevel,
    isWorkSite,
    hostname,
    preset,
    strangerMinutes: hostMinutes,
    strangerLimitMinutes: hardLimitMinutes,
    textSeverity,
    intensityStage,
    humorPercent: typeof settings.humorPercent === 'number' ? settings.humorPercent : DEFAULT_SETTINGS.humorPercent
  };

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'APPLY_POLICY',
      payload
    });
  } catch (e) {
  }
}

async function updateTimeStats(now, mode, isWorkSite, hostname, preset) {
  const timestamp = now.getTime();
  if (lastSample) {
    const delta = timestamp - lastSample.timestamp;
    if (delta > 0 && delta < 60 * 60 * 1000) {
      if (lastSample.mode === 'work' && lastSample.isWorkSite) {
        await addProductiveMs(delta, now);
      }
      if (!lastSample.isWorkSite && lastSample.hostname && lastSample.preset !== 'no_work') {
        await addStrangerMs(lastSample.hostname, delta, now, lastSample.preset);
      }
    }
  }
  lastSample = {
    timestamp,
    mode,
    isWorkSite,
    hostname,
    preset
  };
}

async function getTodayStats(now) {
  const stored = await chrome.storage.local.get(STORAGE_KEY_STATS);
  const stats = stored[STORAGE_KEY_STATS] || {};
  const key = getDateKey(now);
  const dayStats = stats[key] || { productiveMs: 0, strangerByMode: {} };
  if (!dayStats.strangerByMode) {
    dayStats.strangerByMode = {};
  }
  return dayStats;
}

async function addProductiveMs(deltaMs, now) {
  const stored = await chrome.storage.local.get(STORAGE_KEY_STATS);
  const stats = stored[STORAGE_KEY_STATS] || {};
  const key = getDateKey(now);
  const dayStats = stats[key] || { productiveMs: 0 };
  dayStats.productiveMs += deltaMs;
  stats[key] = dayStats;
  await chrome.storage.local.set({ [STORAGE_KEY_STATS]: stats });
}

async function addStrangerMs(hostname, deltaMs, now, preset) {
  const stored = await chrome.storage.local.get(STORAGE_KEY_STATS);
  const stats = stored[STORAGE_KEY_STATS] || {};
  const key = getDateKey(now);
  const dayStats = stats[key] || { productiveMs: 0, strangerByMode: {} };
  if (!dayStats.strangerByMode) {
    dayStats.strangerByMode = {};
  }
  const bucket = dayStats.strangerByMode[preset] || {};
  const prev = bucket[hostname] || 0;
  bucket[hostname] = prev + deltaMs;
  dayStats.strangerByMode[preset] = bucket;
  stats[key] = dayStats;
  await chrome.storage.local.set({ [STORAGE_KEY_STATS]: stats });
}

function getDateKey(now) {
  return now.toISOString().slice(0, 10);
}

