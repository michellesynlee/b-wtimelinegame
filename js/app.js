console.log('[INIT] Script loaded, checking elements...');

const launchOverlay = document.getElementById('launch-overlay');
const launchButton = document.getElementById('launch-button');
const restartButton = document.getElementById('restart-button');
const helpButton = document.getElementById('help-button');
const timerElement = document.getElementById('timer');
const progressCount = document.getElementById('progress-count');
const dropRow = document.getElementById('drop-row');
const placedCardsContainer = document.getElementById('placed-cards');
const activeCardsContainer = document.getElementById('active-cards');
const endOverlay = document.getElementById('end-overlay');
const endTimeElement = document.getElementById('end-time');
const tryAgainButton = document.getElementById('try-again-button');
const viewLeaderboardButton = document.getElementById('view-leaderboard-button');
const articleLinks = document.getElementById('article-links');
const endArticlesPanel = document.getElementById('end-articles-panel');
const endLeaderboardPanel = document.getElementById('end-leaderboard-panel');
const leaderboardList = document.getElementById('leaderboard-list');
const backToArticlesBtn = document.getElementById('back-to-articles-btn');
const playerNameInput = document.getElementById('player-name');

let playerName = '';
let lastFinalTime = 0;

console.log('[INIT] Elements found:', {
  launchOverlay: !!launchOverlay,
  launchButton: !!launchButton,
  dropRow: !!dropRow,
  activeCardsContainer: !!activeCardsContainer
});

let allEvents = [];
let remainingCards = []; // all unplaced cards; first 3 are shown at bottom
let placedEvents = [];
let targetSequence = [];
let timeElapsed = 0;
let timerInterval = null;
let isDragging = false;

function parseCSVRow(row) {
  const values = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length) {
    values.push(current.trim());
  }

  return values.map((value) => value.replace(/""/g, '"'));
}

function parseTimelineEvents(csvText) {
  const lines = csvText.split('\n').filter((line) => line.trim().length > 0);
  lines.shift();
  return lines.map((line, index) => {
    const cells = parseCSVRow(line);
    const year = parseInt(cells[0], 10);
    return {
      id: `event-${index}-${year}`,
      year: Number.isNaN(year) ? null : year,
      shortTitle: cells[1] || 'Untitled event',
      title: cells[2] || 'Untitled event',
      link: cells[4] ? cells[4].trim() : '',
    };
  }).filter((event) => event.year && event.shortTitle && event.title);
}

function shuffle(array) {
  return array.slice().sort(() => Math.random() - 0.5);
}

function loadTimelineEvents() {
  console.log('[LOAD] Starting to load timeline events...');
  
  const fallbackEvents = [
    { id: 'fallback-1', year: 1969, shortTitle: 'First moon landing', title: 'First moon landing' },
    { id: 'fallback-2', year: 1989, shortTitle: 'Fall of the Berlin Wall', title: 'Fall of the Berlin Wall' },
    { id: 'fallback-3', year: 1990, shortTitle: 'Launch of the Hubble Telescope', title: 'Launch of the Hubble Telescope' },
    { id: 'fallback-4', year: 2007, shortTitle: 'Release of the first iPhone', title: 'Release of the first iPhone' },
    { id: 'fallback-5', year: 1925, shortTitle: 'Fight song composed', title: 'Corey Ford composes the Columbia fight song' },
    { id: 'fallback-6', year: 1970, shortTitle: 'Barnard graduates Shange', title: 'Thulani Davis and Ntozake Shange graduate from Barnard' },
    { id: 'fallback-7', year: 2004, shortTitle: 'Levitt drops out', title: 'Joseph Gordon Levitt drops out of Columbia' },
    { id: 'fallback-8', year: 1983, shortTitle: 'Columbia goes co-ed', title: 'Columbia goes co-ed' },
    { id: 'fallback-9', year: 1917, shortTitle: 'First Pulitzer awarded', title: 'The First Pulitzer Prize is awarded' },
    { id: 'fallback-10', year: 1995, shortTitle: 'Lauryn Hill drops out', title: 'Lauryn Hill drops out of Columbia' },
  ];

  fetch('timelineevents.csv')
    .then((response) => response.text())
    .then((text) => {
      allEvents = parseTimelineEvents(text);
      if (allEvents.length < 10) {
        allEvents = fallbackEvents;
      }
      startNewGame();
    })
    .catch(() => {
      allEvents = fallbackEvents;
      startNewGame();
    });
}

function getInitialCards() {
  const shuffled = shuffle(allEvents);
  const selected = [];
  const usedYears = new Set();
  const usedIds = new Set();

  for (let i = 0; i < shuffled.length && selected.length < 10; i += 1) {
    const event = shuffled[i];
    if (!usedYears.has(event.year) && !usedIds.has(event.id)) {
      selected.push(event);
      usedYears.add(event.year);
      usedIds.add(event.id);
    }
  }

  return selected;
}

function startNewGame() {
  const initialEvents = getInitialCards();
  targetSequence = initialEvents.slice().sort((a, b) => a.year - b.year);
  remainingCards = initialEvents.slice();
  placedEvents = [];
  timeElapsed = 0;
  stopTimer();
  timerElement.textContent = '0.0s';
  updateProgress();
  renderTimeline();
  renderActiveCards();
  launchOverlay.classList.remove('hidden');
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    timeElapsed += 0.1;
    timerElement.textContent = `${timeElapsed.toFixed(1)}s`;
  }, 100);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateProgress() {
  progressCount.textContent = `${placedEvents.length} / ${targetSequence.length}`;
}

function makePlacedCard(event) {
  const card = document.createElement('div');
  card.className = 'placed-card';
  card.innerHTML = `
    <span class="placed-date">${event.year}</span>
    <p>${event.shortTitle}</p>
  `;
  return card;
}

function renderTimeline() {
  dropRow.innerHTML = '';

  const sortedPlaced = placedEvents.slice().sort((a, b) => a.year - b.year);

  if (sortedPlaced.length === 0) {
    dropRow.classList.add('single-zone');
    dropRow.appendChild(createDropZone({ minYear: null, maxYear: null, label: 'drop a card to start' }));
    return;
  }

  dropRow.classList.remove('single-zone');
  const earliest = sortedPlaced[0];
  const latest = sortedPlaced[sortedPlaced.length - 1];

  dropRow.appendChild(createDropZone({ minYear: null, maxYear: earliest.year, label: 'earlier' }));

  for (let i = 0; i < sortedPlaced.length; i += 1) {
    const event = sortedPlaced[i];
    dropRow.appendChild(makePlacedCard(event));

    if (i < sortedPlaced.length - 1) {
      const right = sortedPlaced[i + 1];
      const betweenZone = createDropZone({
        minYear: event.year,
        maxYear: right.year,
        label: `between ${event.year} & ${right.year}`,
      });
      betweenZone.classList.add('between-zone');
      dropRow.appendChild(betweenZone);
    }
  }

  dropRow.appendChild(createDropZone({ minYear: latest.year, maxYear: null, label: 'later' }));
}

function renderActiveCards() {
  activeCardsContainer.innerHTML = '';
  const visible = remainingCards.slice(0, 3);

  visible.forEach((event) => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.draggable = true;
    card.dataset.eventId = event.id;
    card.innerHTML = `
      <p class="event-short">${event.shortTitle}</p>
      <span class="event-date">${event.year}</span>
    `;

    card.addEventListener('dragstart', (e) => {
      isDragging = true;
      e.dataTransfer.setData('text/plain', event.id);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      isDragging = false;
      card.classList.remove('dragging');
    });

    // Touch support
    let touchClone = null;
    let lastTouchedZone = null;

    card.addEventListener('touchstart', (e) => {
      isDragging = true;
      card.classList.add('dragging');

      // Create a floating clone to follow the finger
      touchClone = card.cloneNode(true);
      touchClone.style.position = 'fixed';
      touchClone.style.pointerEvents = 'none';
      touchClone.style.opacity = '0.85';
      touchClone.style.zIndex = '9999';
      touchClone.style.width = card.offsetWidth + 'px';
      touchClone.style.height = card.offsetHeight + 'px';
      touchClone.style.margin = '0';
      document.body.appendChild(touchClone);

      const touch = e.touches[0];
      touchClone.style.left = (touch.clientX - card.offsetWidth / 2) + 'px';
      touchClone.style.top = (touch.clientY - card.offsetHeight / 2) + 'px';
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];

      if (touchClone) {
        touchClone.style.left = (touch.clientX - touchClone.offsetWidth / 2) + 'px';
        touchClone.style.top = (touch.clientY - touchClone.offsetHeight / 2) + 'px';
      }

      // Highlight drop zone under finger
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const zone = el ? el.closest('.drop-zone') : null;

      if (lastTouchedZone && lastTouchedZone !== zone) {
        lastTouchedZone.classList.remove('drag-over');
      }
      if (zone) {
        zone.classList.add('drag-over');
      }
      lastTouchedZone = zone;

      // Auto-scroll timeline
      const rect = dropRow.getBoundingClientRect();
      const edgeZone = 80;
      if (touch.clientX < rect.left + edgeZone) {
        dropRow.scrollLeft -= 10;
      } else if (touch.clientX > rect.right - edgeZone) {
        dropRow.scrollLeft += 10;
      }
    }, { passive: false });

    card.addEventListener('touchend', () => {
      isDragging = false;
      card.classList.remove('dragging');

      if (touchClone) {
        document.body.removeChild(touchClone);
        touchClone = null;
      }

      if (lastTouchedZone) {
        lastTouchedZone.classList.remove('drag-over');
        placeCardOnTimeline(event.id, lastTouchedZone);
        lastTouchedZone = null;
      }
    });

    activeCardsContainer.appendChild(card);
  });
}


function getRemainingEvents() {
  return targetSequence.filter((event) => !placedEvents.some((placed) => placed.id === event.id));
}

function getEdgeTargets() {
  const remaining = getRemainingEvents();
  if (placedEvents.length === 0) {
    return { left: null, right: null };
  }

  const sorted = placedEvents.slice().sort((a, b) => a.year - b.year);
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];

  const leftTarget = remaining
    .filter((event) => event.year < earliest.year)
    .sort((a, b) => b.year - a.year)[0] || null;

  const rightTarget = remaining
    .filter((event) => event.year > latest.year)
    .sort((a, b) => a.year - b.year)[0] || null;

  return { left: leftTarget, right: rightTarget };
}

function createDropZone({ minYear, maxYear, label }) {
  const zone = document.createElement('div');
  zone.className = 'drop-zone';
  
  // Store year constraints as data attributes
  zone.dataset.minYear = minYear !== null ? String(minYear) : '';
  zone.dataset.maxYear = maxYear !== null ? String(maxYear) : '';
  
  zone.innerHTML = `<span>${label}</span>`;
  
  // Add drag and drop listeners
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  zone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', (e) => {
    if (!zone.contains(e.relatedTarget)) {
      zone.classList.remove('drag-over');
    }
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const eventId = e.dataTransfer.getData('text/plain');
    console.log('[DROP] Drop event fired, eventId:', eventId, 'on zone', label);
    if (!eventId) {
      console.log('[DROP] No eventId from dataTransfer');
      return;
    }
    placeCardOnTimeline(eventId, zone);
  });
  
  return zone;
}


function showInvalidCard(eventId) {
  const card = document.querySelector(`[data-event-id="${eventId}"]`);
  if (!card) return;
  card.classList.add('invalid');
  setTimeout(() => card.classList.remove('invalid'), 500);
}

function placeCardOnTimeline(eventId, zone) {
  console.log('[PLACE] placeCardOnTimeline called with', eventId);
  const cardIndex = remainingCards.findIndex((event) => event.id === eventId);
  if (cardIndex === -1) {
    console.log('[PLACE] Card not found in remainingCards');
    return false;
  }

  const placedEvent = remainingCards[cardIndex];
  const minYear = zone.dataset.minYear && zone.dataset.minYear !== '' ? Number(zone.dataset.minYear) : null;
  const maxYear = zone.dataset.maxYear && zone.dataset.maxYear !== '' ? Number(zone.dataset.maxYear) : null;

  if (placedEvents.length > 0) {
    if ((minYear !== null && placedEvent.year <= minYear) || (maxYear !== null && placedEvent.year >= maxYear)) {
      console.log('[PLACE] Card year validation failed:', placedEvent.year, 'min:', minYear, 'max:', maxYear);
      showInvalidCard(eventId);
      return false;
    }
  }

  console.log('[PLACE] Placing card:', placedEvent.shortTitle, 'year:', placedEvent.year);
  remainingCards.splice(cardIndex, 1);
  placedEvents.push(placedEvent);
  isDragging = false;
  updateProgress();
  renderTimeline();
  renderActiveCards();

  if (placedEvents.length === targetSequence.length) {
    stopTimer();
    setTimeout(async () => {
      lastFinalTime = timeElapsed;
      endTimeElement.textContent = `${lastFinalTime.toFixed(1)}s`;

      // Populate articles
      const linkedEvents = targetSequence.filter((e) => e.link);
      articleLinks.innerHTML = linkedEvents.length > 0
        ? linkedEvents.map((e) => `
            <a class="article-link" href="${e.link}" target="_blank" rel="noopener noreferrer">
              ${e.shortTitle}
            </a>
          `).join('')
        : '<p class="no-articles">No related articles for this round.</p>';

      // Update leaderboard
      await saveToLeaderboard(playerName || 'Anonymous', lastFinalTime);

      // Reset to articles view
      endArticlesPanel.classList.remove('hidden');
      endLeaderboardPanel.classList.add('hidden');

      endOverlay.classList.remove('hidden');
    }, 400);
  }

  return true;
}



const SUPABASE_URL = 'https://dviqujvqvfqwqwetpycv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2aXF1anZxdmZxd3F3ZXRweWN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjU3MjIsImV4cCI6MjA5MTUwMTcyMn0.0w-hkSzhsIESL3BPRUr6IqWHMf7mea_0ngECaqjXn2M';

function sbHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function saveToLeaderboard(name, time) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ name, time }),
    });
    if (!res.ok) {
      console.warn('[LEADERBOARD] Save failed:', await res.text());
    } else {
      console.log('[LEADERBOARD] Saved:', name, time);
    }
  } catch (e) {
    console.warn('[LEADERBOARD] Network error saving:', e);
  }
}

async function renderLeaderboard(currentTime) {
  leaderboardList.innerHTML = '<li style="border:none;background:none;color:#888;font-style:italic;">Loading...</li>';
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/leaderboard?select=name,time&order=time.asc&limit=10`,
      { headers: sbHeaders() }
    );
    const data = await res.json();
    if (!data.length) {
      leaderboardList.innerHTML = '<li style="border:none;background:none;color:#888;font-style:italic;">No scores yet.</li>';
      return;
    }
    leaderboardList.innerHTML = data.map((entry, i) => {
      const isYou = entry.time === currentTime && entry.name === (playerName || 'Anonymous');
      return `
        <li class="${isYou ? 'leaderboard-you' : ''}">
          <span class="lb-rank">${i + 1}.</span>
          <span class="lb-name">${entry.name}${isYou ? ' (you)' : ''}</span>
          <span class="lb-time">${entry.time.toFixed(1)}s</span>
        </li>
      `;
    }).join('');
  } catch (e) {
    leaderboardList.innerHTML = '<li style="border:none;background:none;color:#888;font-style:italic;">Could not load scores.</li>';
    console.warn('[LEADERBOARD] Network error loading:', e);
  }
}

viewLeaderboardButton.addEventListener('click', () => {
  endArticlesPanel.classList.add('hidden');
  endLeaderboardPanel.classList.remove('hidden');
  renderLeaderboard(lastFinalTime);
});

backToArticlesBtn.addEventListener('click', () => {
  endLeaderboardPanel.classList.add('hidden');
  endArticlesPanel.classList.remove('hidden');
});

launchButton.addEventListener('click', () => {
  playerName = playerNameInput.value.trim();
  if (!playerName) {
    playerNameInput.classList.add('input-error');
    playerNameInput.placeholder = 'please enter a name';
    playerNameInput.addEventListener('input', () => {
      playerNameInput.classList.remove('input-error');
      playerNameInput.placeholder = 'your name';
    }, { once: true });
    return;
  }
  launchOverlay.classList.add('hidden');
  startTimer();
});

restartButton.addEventListener('click', () => {
  endOverlay.classList.add('hidden');
  startNewGame();
});

tryAgainButton.addEventListener('click', () => {
  endOverlay.classList.add('hidden');
  startNewGame();
});



// Auto-scroll the timeline when dragging near the edges
let autoScrollInterval = null;
let autoScrollDirection = 0;

function stopAutoScroll() {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
  autoScrollDirection = 0;
}

function startAutoScroll(direction) {
  if (autoScrollDirection === direction) return;
  stopAutoScroll();
  autoScrollDirection = direction;
  autoScrollInterval = setInterval(() => {
    dropRow.scrollLeft += direction * 14;
  }, 16);
}

document.addEventListener('dragover', (e) => {
  if (!isDragging) return;
  const rect = dropRow.getBoundingClientRect();
  const edgeZone = 150;
  const x = e.clientX;

  if (x < rect.left + edgeZone) {
    startAutoScroll(-1);
  } else if (x > rect.right - edgeZone) {
    startAutoScroll(1);
  } else {
    stopAutoScroll();
  }
});

document.addEventListener('dragend', stopAutoScroll);
document.addEventListener('drop', stopAutoScroll);

loadTimelineEvents();
