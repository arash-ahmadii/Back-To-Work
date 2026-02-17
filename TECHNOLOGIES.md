Technologies Used in Back To Work
=================================

This document briefly describes the main technologies and concepts used to build the extension.

Chrome Extension Platform
-------------------------

- **Chrome Extensions – Manifest V3**  
  The project is a standard Chrome extension using **Manifest Version 3**, with:
  - A **background service worker** (`background.js`) for scheduling, storage and policy logic
  - A **content script** (`content.js`) injected into web pages to apply visual friction
  - A **browser action popup** (`popup.html` / `popup.js`)
  - An **options page** (`options.html` / `options.js`) for configuration

Web Technologies
----------------

- **HTML & CSS**  
  - Custom popup and options UI built with plain HTML and CSS (no UI framework).
  - Tailored styling for dark, minimal, focused look.
- **JavaScript (vanilla)**  
  - No frontend framework or build step.  
  - All logic is written in plain JavaScript files loaded directly by Chrome.

Browser APIs
------------

- **`chrome.storage.local`**  
  Stores:
  - User settings (work sites, schedule, extension mood)
  - Lightweight statistics for today’s productive time and time on non‑work sites

- **`chrome.alarms`**  
  - Periodic timer to:
    - Sample time spent on the current site
    - Reset weekly statistics

- **`chrome.tabs`**  
  - Reads the active tab and its URL
  - Applies the current “policy” (mode + friction level) to that tab

- **`chrome.runtime` messaging**  
  - Popup and options page communicate with the background script using `chrome.runtime.sendMessage`.
  - The background script notifies the content script when to apply or clear friction.

Design Concepts
---------------

- **Identity‑based nudging**  
  The extension is designed around the idea of “work identity” vs “free identity” instead of strict blocking.

- **Gradual friction**  
  Visual and interaction friction increases in stages (mild → medium → strong) based on how long you stay on non‑work sites.

- **Local‑only data**  
  All data is stored locally in the browser; there is no server component or external API.

