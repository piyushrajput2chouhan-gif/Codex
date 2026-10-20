import './style.css';
import planet from '@phosphor-icons/core/assets/regular/planet.svg?raw';
import plus from '@phosphor-icons/core/assets/regular/plus.svg?raw';
import squares from '@phosphor-icons/core/assets/regular/squares-four.svg?raw';
import clock from '@phosphor-icons/core/assets/regular/clock-counter-clockwise.svg?raw';
import gear from '@phosphor-icons/core/assets/regular/gear-six.svg?raw';
import arrowUp from '@phosphor-icons/core/assets/regular/arrow-up.svg?raw';
import arrowRight from '@phosphor-icons/core/assets/regular/arrow-right.svg?raw';
import calendar from '@phosphor-icons/core/assets/regular/calendar-blank.svg?raw';
import search from '@phosphor-icons/core/assets/regular/magnifying-glass.svg?raw';
import play from '@phosphor-icons/core/assets/regular/play.svg?raw';
import pause from '@phosphor-icons/core/assets/regular/pause.svg?raw';
import dots from '@phosphor-icons/core/assets/regular/dots-three.svg?raw';
import x from '@phosphor-icons/core/assets/regular/x.svg?raw';
import check from '@phosphor-icons/core/assets/regular/check.svg?raw';
import copy from '@phosphor-icons/core/assets/regular/copy.svg?raw';
import download from '@phosphor-icons/core/assets/regular/download-simple.svg?raw';
import warning from '@phosphor-icons/core/assets/regular/warning-circle.svg?raw';
import lightning from '@phosphor-icons/core/assets/regular/lightning.svg?raw';
import list from '@phosphor-icons/core/assets/regular/list.svg?raw';
import tray from '@phosphor-icons/core/assets/regular/tray.svg?raw';
import user from '@phosphor-icons/core/assets/regular/user-circle.svg?raw';
import repeat from '@phosphor-icons/core/assets/regular/repeat.svg?raw';

const icons = { planet, plus, squares, clock, gear, arrowUp, arrowRight, calendar, search, play, pause, dots, x, check, copy, download, warning, lightning, list, tray, user, repeat };
const icon = (name, cls = '') => `<span class="icon ${cls}" aria-hidden="true">${icons[name] || icons.squares}</span>`;
const escape = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const state = { tasks: [], runs: [], status: null, view: 'tasks', filter: 'all', search: '', busy: new Set(), loading: true, taskId: null, runId: null };
let toastTimer;
let refreshBusy = false;
let authRedirecting = false;
const suggestions = [
  { icon: 'lightning', label: 'Plan my week', prompt: 'Create a practical weekly planning checklist. Help me prioritize important work, reserve focus time, and leave room for unexpected tasks.' },
  { icon: 'repeat', label: 'A daily writing prompt', prompt: 'Give me one thoughtful creative writing prompt with a fresh angle, a short example, and a 10-minute exercise.' },
  { icon: 'squares', label: 'Brainstorm an idea', prompt: 'Suggest five useful small business ideas I can explore this week. Include a simple first step and a way to validate each idea.' },
];

document.querySelector('#app').innerHTML = `
  <div class="app-shell">
    <button class="sidebar-shade" aria-label="Close navigation" data-action="close-nav"></button>
    <aside class="sidebar" aria-label="Main navigation">
      <a class="brand" href="#tasks" aria-label="Orbit home">${icon('planet')}<span>orbit<span class="brand-dot">.</span></span></a>
      <button class="new-task" data-action="new">${icon('plus')}<span>New task</span><kbd>N</kbd></button>
      <div class="nav-label">WORKSPACE</div>
      <nav class="nav-links">
        <a href="#tasks" data-view="tasks" class="nav-link active">${icon('squares')}<span>Tasks</span><span class="nav-count" id="task-count">0</span></a>
        <a href="#history" data-view="history" class="nav-link">${icon('clock')}<span>Run history</span></a>
        <a href="#settings" data-view="settings" class="nav-link">${icon('gear')}<span>Settings</span></a>
      </nav>
      <div class="sidebar-bottom">
        <div class="always-card">${icon('planet')}<p>A little help.<br><strong>Around the clock.</strong></p><span>Save a task. Set a rhythm.<br>Let Orbit take the next turn.</span></div>
        <div class="workspace-account">${icon('user')}<div><strong>Your workspace</strong><span>Stored on this server</span></div></div>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-menu" aria-label="Open navigation" data-action="menu">${icon('list')}</button><span class="breadcrumb-root">Workspace</span><span class="slash">/</span><strong id="page-name">Tasks</strong></div><div class="topbar-right"><span class="scheduler-state" id="scheduler-state"><i></i>Connecting</span><span class="topbar-divider"></span><span class="workspace-type">Personal workspace</span><button class="logout-button" type="button" data-action="logout">Log out</button></div></header>
      <div id="connection-error" class="connection-error" hidden role="alert"></div>
      <main id="main" tabindex="-1">
        <section id="tasks-view" class="view task-view">
          <div class="intro"><div class="eyebrow">YOUR TIME, BACK IN YOUR HANDS</div><h1>A little less busywork<span>.</span></h1><p>Give your next task a home. We’ll keep it moving.</p></div>
          <form id="composer" class="composer">
            <label for="task-prompt" class="sr-only">What would you like Orbit to do?</label><textarea id="task-prompt" name="prompt" placeholder="What would you like to take off your plate?" rows="3" maxlength="20000" required></textarea>
            <div class="composer-title-row" id="composer-title-row" hidden><label for="task-title">Task name <span>optional</span></label><input id="task-title" name="title" placeholder="Give this task a name" maxlength="160" autocomplete="off"></div>
            <div class="composer-toolbar"><div class="schedule-control">${icon('calendar')}<label for="task-schedule" class="sr-only">Task schedule</label><select id="task-schedule" name="schedule"><option value="once">Run manually</option><option value="hourly">Every hour</option><option value="daily">Every day</option><option value="weekly">Every week</option></select></div><button type="button" class="text-button add-time" data-action="schedule-time" aria-label="Choose start time">Start time</button><button class="save-button" type="submit"><span>Save task</span>${icon('arrowUp')}</button></div>
            <div class="composer-date" id="composer-date" hidden><label for="task-date">First run <span>(your local time)</span></label><input id="task-date" type="datetime-local" name="scheduledAt"><button class="text-button" type="button" data-action="clear-time">Clear</button></div>
            <p class="form-error" id="composer-error" hidden role="alert"></p>
          </form>
          <div class="suggestions"><span>Need a starting point?</span>${suggestions.map((item, index) => `<button class="suggestion" data-suggestion="${index}">${icon(item.icon)}${item.label}</button>`).join('')}</div>
          <div class="provider-notice" id="provider-notice" hidden>${icon('lightning')}<span>Your tasks are saved. Connect an AI provider to run them.</span><a href="#settings">Set up AI ${icon('arrowRight')}</a></div>
          <section class="saved-section" aria-labelledby="saved-heading"><div class="section-heading"><div><h2 id="saved-heading">Your tasks <span id="saved-count">0</span></h2><p>A place for everything you’d rather delegate.</p></div><span class="saved-caption">${icon('tray')} Stored on this server</span></div>
            <div class="list-toolbar"><div class="filter-tabs" role="group" aria-label="Filter tasks"><button class="active" data-filter="all" aria-pressed="true">All tasks</button><button data-filter="scheduled" aria-pressed="false">Scheduled</button><button data-filter="paused" aria-pressed="false">Paused</button></div><div class="search-field">${icon('search')}<label for="task-search" class="sr-only">Search tasks</label><input id="task-search" type="search" placeholder="Search tasks…" autocomplete="off"></div></div>
            <div id="task-list" class="task-list" aria-live="polite"></div>
          </section>
          <footer class="workspace-footer"><span>${icon('planet')} Room to think. Space to get things done.</span><span>Built for your everyday orbit.</span></footer>
        </section>
        <section id="history-view" class="view" hidden><div class="page-intro"><div class="eyebrow">EVERY TURN, IN ONE PLACE</div><h1>Run history<span>.</span></h1><p>Pick up where your tasks left off. Every result stays saved.</p></div><div class="history-heading"><span id="history-count">0 runs</span><button class="secondary-button" data-action="refresh-history">${icon('clock')}Refresh</button></div><div id="history-list" class="history-list"></div></section>
        <section id="settings-view" class="view" hidden><div class="page-intro"><div class="eyebrow">MAKE YOURSELF AT HOME</div><h1>Workspace settings<span>.</span></h1><p>A few essentials to keep your tasks moving.</p></div><div id="settings-content"></div></section>
      </main>
    </div>
  </div><div id="toast" class="toast" role="status" hidden></div>
  <dialog id="task-dialog" class="task-dialog" aria-labelledby="dialog-title"><div id="task-dialog-content"></div></dialog>
  <dialog id="result-dialog" class="result-dialog" aria-labelledby="result-title"><div id="result-dialog-content"></div></dialog>`;

function redirectToLogin() {
  if (authRedirecting) return;
  authRedirecting = true;
  clearTimeout(toastTimer);
  state.tasks = []; state.runs = []; state.status = null;
  $$('dialog[open]').forEach((dialog) => dialog.close());
  $('#app').hidden = true;
  const message = document.createElement('p');
  message.className = 'session-redirect';
  message.setAttribute('role', 'status');
  message.textContent = 'Returning to sign in…';
  document.body.append(message);
  document.title = 'Sign in · Orbit';
  window.location.replace('/login');
}
async function api(path, options = {}) {
  if (authRedirecting) throw new Error('Sign in to access your workspace.');
  const response = await fetch(path, { ...options, credentials: 'same-origin', headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  if (response.status === 401) {
    redirectToLogin();
    throw new Error('Your session has ended. Sign in again.');
  }
  if (authRedirecting) throw new Error('Sign in to access your workspace.');
  let data;
  try { data = await response.json(); } catch { throw new Error('The server returned an unreadable response. Try again.'); }
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Something went wrong. Try again.');
  return data;
}
function toast(message, isError = false) {
  if (authRedirecting) return;
  clearTimeout(toastTimer);
  const element = $('#toast');
  element.classList.toggle('toast-error', isError);
  element.innerHTML = `${icon(isError ? 'warning' : 'check')}<span>${escape(message)}</span>`;
  element.hidden = false;
  toastTimer = setTimeout(() => { element.hidden = true; }, isError ? 6500 : 4000);
}
function friendlyDate(date, options = {}) {
  if (!date || !Number.isFinite(Date.parse(date))) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...options }).format(new Date(date));
}
function localDate(date) {
  if (!date) return '';
  const value = new Date(date);
  if (!Number.isFinite(value.getTime())) return '';
  const shifted = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}
function scheduleLabel(task) {
  if (!task.enabled) return 'Paused';
  if (task.schedule === 'once') return task.nextRunAt ? `Once · ${friendlyDate(task.nextRunAt)}` : 'Run manually';
  return { hourly: 'Every hour', daily: 'Every day', weekly: 'Every week' }[task.schedule] || 'Run manually';
}
function statusBadge(run) {
  const text = { succeeded: 'Completed', failed: 'Failed', running: 'Running' }[run.status] || 'Unknown';
  return `<span class="status-badge status-${escape(run.status)}">${icon(run.status === 'succeeded' ? 'check' : run.status === 'failed' ? 'warning' : 'clock')} ${text}</span>`;
}
function empty(iconName, title, description, button = '') {
  return `<div class="empty-state"><div class="empty-icon">${icon(iconName)}</div><h3>${title}</h3><p>${description}</p>${button}</div>`;
}
function renderTasks() {
  const signature = JSON.stringify([state.tasks, state.runs.filter((run) => run.status === 'running').map((run) => run.taskId), [...state.busy], state.filter, state.search, state.loading]);
  if (state.taskRenderSignature === signature) return;
  state.taskRenderSignature = signature;
  const focused = $('#task-list').contains(document.activeElement) ? { action: document.activeElement.dataset.action, id: document.activeElement.dataset.id } : null;
  $('#task-count').textContent = state.tasks.length;
  $('#saved-count').textContent = state.tasks.length;
  const tasks = state.tasks.filter((task) => (state.filter !== 'scheduled' || (task.enabled && task.nextRunAt)) && (state.filter !== 'paused' || !task.enabled) && `${task.title} ${task.prompt}`.toLowerCase().includes(state.search.toLowerCase()));
  if (state.loading) { $('#task-list').innerHTML = `<div class="loading-state"><span class="spinner"></span>Loading your workspace…</div>`; return; }
  if (!tasks.length) {
    $('#task-list').innerHTML = state.tasks.length ? empty('search', 'Nothing here just yet', 'Try another search or filter to find your task.', '<button class="text-button" data-action="reset-filters">Clear filters</button>') : empty('tray', 'Your next free hour starts here', 'Save your first task above. Run it when you need it,<br class="desktop-break"> or give it a schedule and make a little room in your day.', '<button class="empty-start" data-action="new">Create your first task ' + icon('arrowRight') + '</button>');
    return;
  }
  $('#task-list').innerHTML = tasks.map((task) => {
    const running = state.runs.some((run) => run.taskId === task.id && run.status === 'running');
    return `<article class="task-row ${!task.enabled ? 'task-paused' : ''}" data-task-id="${escape(task.id)}"><button class="task-open" data-action="edit" data-id="${escape(task.id)}" aria-label="Edit ${escape(task.title)}"><span class="task-symbol">${icon(task.schedule === 'once' ? 'squares' : 'repeat')}</span><div class="task-copy"><h3>${escape(task.title)}</h3><p>${escape(task.prompt)}</p><div class="task-meta"><span class="schedule-label">${icon(task.enabled ? 'calendar' : 'pause')}${escape(scheduleLabel(task))}</span>${running ? '<span class="run-dot">Running now</span>' : task.lastRunAt ? `<span>Last run ${escape(friendlyDate(task.lastRunAt))}</span>` : '<span>No runs yet</span>'}</div></div></button><div class="task-actions"><button class="run-button" data-action="run" data-id="${escape(task.id)}" ${running || state.busy.has(task.id) ? 'disabled' : ''} aria-label="Run ${escape(task.title)} now">${icon(running ? 'clock' : 'play')}<span>${running ? 'Running' : 'Run now'}</span></button><button class="icon-button task-more" data-action="edit" data-id="${escape(task.id)}" aria-label="Task details for ${escape(task.title)}">${icon('dots')}</button></div></article>`;
  }).join('');
  if (focused?.action && focused?.id) $$('#task-list [data-action]').find((element) => element.dataset.action === focused.action && element.dataset.id === focused.id)?.focus({ preventScroll: true });
}
function renderHistory() {
  const signature = JSON.stringify([state.runs, state.tasks.map(({ id, title }) => ({ id, title }))]);
  if (state.historyRenderSignature === signature) return;
  state.historyRenderSignature = signature;
  const focusedRun = $('#history-list').contains(document.activeElement) ? document.activeElement.dataset.id : null;
  $('#history-count').textContent = `${state.runs.length} ${state.runs.length === 1 ? 'run' : 'runs'}`;
  $('#history-list').innerHTML = state.runs.length ? `<div class="history-labels"><span>TASK</span><span>STATUS</span><span>STARTED</span><span></span></div>${state.runs.map((run) => {
    const task = state.tasks.find((item) => item.id === run.taskId);
    return `<button class="history-row" data-action="result" data-id="${escape(run.id)}"><span class="history-task">${icon('squares')}<span><strong>${escape(task?.title || 'Task')}</strong><span>${escape(run.error || (run.status === 'running' ? 'Working on your task…' : run.output ? `${run.output.slice(0, 80)}${run.output.length > 80 ? '…' : ''}` : 'No output'))}</span></span></span>${statusBadge(run)}<span class="history-date">${escape(friendlyDate(run.startedAt))}</span>${icon('arrowRight')}</button>`;
  }).join('')}` : empty('clock', 'A clean slate', 'Once you run a task, its progress and saved result will appear here.', '<button class="empty-start" data-action="new">Create a task ' + icon('arrowRight') + '</button>');
  if (focusedRun) $$('#history-list [data-action="result"]').find((element) => element.dataset.id === focusedRun)?.focus({ preventScroll: true });
}
function renderStatus() {
  const status = state.status;
  const connected = Boolean(status?.heartbeatAt && Date.now() - Date.parse(status.heartbeatAt) < 30000);
  $('#scheduler-state').classList.toggle('connected', connected);
  $('#scheduler-state').innerHTML = `<i></i>${connected ? 'Scheduler online' : status ? 'Scheduler idle' : 'Connecting'}`;
  $('#provider-notice').hidden = !status || status.providerConfigured;
  if (state.view === 'settings') renderSettings();
}
function renderSettings() {
  const status = state.status;
  const signature = JSON.stringify([status?.providerConfigured, status?.model]);
  if (state.settingsRenderSignature === signature) return;
  state.settingsRenderSignature = signature;
  $('#settings-content').innerHTML = `<section class="settings-card"><div class="settings-card-title">${icon('lightning')}<div><h2>AI connection</h2><p>The engine behind your tasks.</p></div><span class="connection-badge ${status?.providerConfigured ? 'is-connected' : ''}">${status?.providerConfigured ? 'Configured' : 'Setup needed'}</span></div><div class="setting-row"><span>Provider</span><strong>OpenAI-compatible API</strong></div><div class="setting-row"><span>Model</span><strong>${escape(status?.model || 'Not configured')}</strong></div><div class="settings-instructions"><h3>${status?.providerConfigured ? 'Your AI provider is configured.' : 'Connect your AI provider'}</h3><p>Set the server-side <code>AI_API_KEY</code> secret and the <code>AI_BASE_URL</code> and <code>AI_MODEL</code> variables, then restart the server. All three are required. Keep API keys on the server.</p><p class="settings-hint">Configuration status confirms these variables are set. Provider access is checked when a task runs.</p></div><button class="secondary-button" data-action="check-status">${icon('repeat')}Check configuration</button></section><section class="settings-card"><div class="settings-card-title">${icon('planet')}<div><h2>How your workspace works</h2><p>A small team of one, with a little extra help.</p></div></div><div class="setting-info"><h3>Always on, while your server is running</h3><p>Scheduled tasks continue when you close this tab. Keep the server and its persistent storage running for around-the-clock work. Missed recurring intervals resume with one run when the server returns.</p></div><div class="setting-info"><h3>AI writing and reasoning</h3><p>Tasks generate text using your configured model. Orbit currently has no browser access, live web search, email sending, or external app actions.</p></div><div class="setting-info"><h3>Your tasks and results stay saved</h3><p>Tasks, schedules, and results are stored in SQLite on this server. Back up its data directory to keep them safe. This workspace uses a shared password for access. Keep that password private and use HTTPS when hosting it publicly.</p></div><div class="setting-row"><span>Your timezone</span><strong>${escape(Intl.DateTimeFormat().resolvedOptions().timeZone)}</strong></div></section><p class="settings-note">Orbit is an independent task assistant and is not affiliated with xAI or Grok.</p>`;
}

async function refresh({ quiet = false } = {}) {
  if (refreshBusy || authRedirecting) return;
  refreshBusy = true;
  try {
    const needsTasks = !quiet || state.view !== 'settings' || $('#task-dialog').open || $('#result-dialog').open;
    const [tasks, status] = await Promise.all([needsTasks ? api('/api/tasks') : Promise.resolve(null), api('/api/status')]);
    const needsRuns = !quiet || state.view === 'history' || $('#task-dialog').open || $('#result-dialog').open || status.activeRuns > 0 || state.runs.some((run) => run.status === 'running');
    if (needsRuns) state.runs = (await api('/api/runs')).runs;
    if (authRedirecting) return;
    if (tasks) state.tasks = tasks.tasks;
    state.status = status; state.loading = false;
    $('#connection-error').hidden = true;
    renderTasks(); renderHistory(); renderStatus();
    if ($('#task-dialog').open && state.taskId) renderTaskRuns();
    if ($('#result-dialog').open && state.runId) renderResultBody();
  } catch (error) {
    if (authRedirecting) return;
    state.loading = false;
    $('#connection-error').textContent = `Workspace unavailable: ${error.message}`;
    $('#connection-error').hidden = false;
    if (!quiet) toast(error.message, true);
    renderTasks();
  } finally { refreshBusy = false; }
}
function changeView(view) {
  if (!['tasks', 'history', 'settings'].includes(view)) view = 'tasks';
  state.view = view;
  $$('.view').forEach((element) => { element.hidden = element.id !== `${view}-view`; });
  $$('.nav-link').forEach((element) => { element.classList.toggle('active', element.dataset.view === view); element.setAttribute('aria-current', element.dataset.view === view ? 'page' : 'false'); });
  $('#page-name').textContent = { tasks: 'Tasks', history: 'Run history', settings: 'Settings' }[view];
  document.title = `${{ tasks: 'Tasks', history: 'Run history', settings: 'Settings' }[view]} · Orbit`;
  document.body.classList.remove('nav-open');
  if (view === 'settings') renderSettings();
  if (view === 'history') renderHistory();
}
function focusComposer() {
  if (location.hash !== '#tasks') location.hash = 'tasks';
  changeView('tasks');
  $('#task-prompt').focus();
  $('#composer').scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function formDate(input) {
  if (!input.value) return null;
  const date = new Date(input.value);
  if (!Number.isFinite(date.getTime())) throw new Error('Choose a valid start time.');
  return date.toISOString();
}
$('#task-prompt').addEventListener('input', () => { $('#composer-title-row').hidden = !$('#task-prompt').value.trim(); });
$('#composer').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('button[type="submit"]', event.currentTarget);
  const prompt = $('#task-prompt').value.trim();
  if (!prompt) return;
  button.disabled = true;
  $('#composer-error').hidden = true;
  try {
    const title = $('#task-title').value.trim() || prompt.replace(/\s+/g, ' ').slice(0, 80);
    await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title, prompt, schedule: $('#task-schedule').value, scheduledAt: formDate($('#task-date')), enabled: true }) });
    $('#composer').reset(); $('#composer-title-row').hidden = true; $('#composer-date').hidden = true;
    toast('Task saved. A little more room in your day.');
    await refresh();
  } catch (error) {
    $('#composer-error').textContent = error.message; $('#composer-error').hidden = false;
  } finally { button.disabled = false; }
});
$('#task-search').addEventListener('input', (event) => { state.search = event.target.value; renderTasks(); });

function openTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  state.taskId = id;
  $('#task-dialog-content').innerHTML = `<div class="dialog-header"><div><div class="eyebrow">TASK DETAILS</div><h2 id="dialog-title">Make it yours.</h2></div><button class="icon-button" data-action="close-task" aria-label="Close task details">${icon('x')}</button></div><form id="edit-task-form" class="edit-form"><label for="edit-title">Task name</label><input id="edit-title" name="title" value="${escape(task.title)}" required maxlength="160"><label for="edit-prompt">Instructions</label><textarea id="edit-prompt" name="prompt" rows="5" required maxlength="20000">${escape(task.prompt)}</textarea><div class="form-columns"><div><label for="edit-schedule">Schedule</label><select id="edit-schedule" name="schedule">${[['once', 'Run manually / once'], ['hourly', 'Every hour'], ['daily', 'Every day'], ['weekly', 'Every week']].map(([value, label]) => `<option value="${value}" ${task.schedule === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div><label for="edit-date">First run <span>(local time)</span></label><input id="edit-date" type="datetime-local" value="${escape(localDate(task.scheduledAt))}"></div></div><p class="field-help">Leave the first run blank to run manually or begin after one interval.</p><label class="checkbox-label"><input id="edit-enabled" type="checkbox" ${task.enabled ? 'checked' : ''}>Task enabled <span>Pause to stop scheduled runs.</span></label><div class="form-error" id="edit-error" hidden role="alert"></div><div class="edit-actions"><button class="text-button danger" data-action="confirm-delete" type="button">Delete task</button><button class="save-button" type="submit">Save changes ${icon('check')}</button></div><div class="delete-confirm" id="delete-confirm" hidden><p>Delete this task and its saved results? This cannot be undone.</p><button type="button" class="danger-button" data-action="delete" data-id="${escape(id)}">Delete task</button><button type="button" class="text-button" data-action="cancel-delete">Keep task</button></div></form><section class="task-runs-section"><div class="task-runs-heading"><h3>Recent runs</h3><button class="secondary-button" data-action="run" data-id="${escape(id)}">${icon('play')}Run now</button></div><div id="task-runs"></div></section>`;
  renderTaskRuns();
  $('#edit-task-form').addEventListener('submit', saveTask);
  $('#task-dialog').showModal();
}
function renderTaskRuns() {
  const target = $('#task-runs');
  if (!target) return;
  const runs = state.runs.filter((run) => run.taskId === state.taskId).slice(0, 8);
  const signature = JSON.stringify([runs.map(({ id, status }) => ({ id, status })), [...state.busy], state.taskId]);
  if (target.dataset.signature === signature) return;
  target.dataset.signature = signature;
  const focusedRun = target.contains(document.activeElement) ? document.activeElement.dataset.id : null;
  const running = runs.some((run) => run.status === 'running');
  const button = $('.task-runs-heading button');
  if (button) { button.disabled = running || state.busy.has(state.taskId); button.innerHTML = `${icon(running ? 'clock' : 'play')}${running ? 'Running' : 'Run now'}`; }
  target.innerHTML = runs.length ? runs.map((run) => `<button class="mini-run" data-action="result" data-id="${escape(run.id)}">${statusBadge(run)}<span>${escape(friendlyDate(run.startedAt))}</span>${icon('arrowRight')}</button>`).join('') : '<p class="quiet-note">No runs yet. Your results will be saved here.</p>';
  if (focusedRun) $$('[data-action="result"]', target).find((element) => element.dataset.id === focusedRun)?.focus({ preventScroll: true });
}
async function saveTask(event) {
  event.preventDefault();
  const button = $('button[type="submit"]', event.currentTarget);
  const errorElement = $('#edit-error');
  button.disabled = true; errorElement.hidden = true;
  try {
    await api(`/api/tasks/${encodeURIComponent(state.taskId)}`, { method: 'PATCH', body: JSON.stringify({ title: $('#edit-title').value.trim(), prompt: $('#edit-prompt').value.trim(), schedule: $('#edit-schedule').value, scheduledAt: formDate($('#edit-date')), enabled: $('#edit-enabled').checked }) });
    $('#task-dialog').close(); toast('Changes saved.'); await refresh();
  } catch (error) { errorElement.textContent = error.message; errorElement.hidden = false; }
  finally { button.disabled = false; }
}
async function runTask(id) {
  if (state.busy.has(id)) return;
  state.busy.add(id); renderTasks(); renderTaskRuns();
  try {
    const data = await api(`/api/tasks/${encodeURIComponent(id)}/run`, { method: 'POST' });
    const run = data.run || data;
    state.runs = [run, ...state.runs.filter((item) => item.id !== run.id)];
    renderHistory(); renderTaskRuns();
    toast('Task started. Your result will be saved.');
    openResult(run.id);
    await refresh({ quiet: true });
  } catch (error) { toast(error.message, true); }
  finally { state.busy.delete(id); renderTasks(); renderTaskRuns(); }
}
function openResult(id) {
  const run = state.runs.find((item) => item.id === id);
  if (!run) return;
  state.runId = id;
  const task = state.tasks.find((item) => item.id === run.taskId);
  $('#result-dialog-content').innerHTML = `<div class="dialog-header"><div><div class="eyebrow">SAVED RESULT</div><h2 id="result-title">${escape(task?.title || 'Task result')}</h2></div><button class="icon-button" data-action="close-result" aria-label="Close result">${icon('x')}</button></div><div id="result-body"></div>`;
  renderResultBody();
  if (!$('#result-dialog').open) $('#result-dialog').showModal();
}
function renderResultBody() {
  const run = state.runs.find((item) => item.id === state.runId);
  if (!run || !$('#result-body')) return;
  const existingStatus = $('#result-body').dataset.status;
  if (existingStatus === run.status) return;
  $('#result-body').dataset.status = run.status;
  $('#result-body').innerHTML = `<div class="result-meta">${statusBadge(run)}<span>${escape(friendlyDate(run.startedAt))}</span></div>${run.status === 'running' ? '<div class="result-running"><span class="spinner"></span><h3>A little work in progress.</h3><p>You can close this panel. Your result will be saved when it’s ready.</p></div>' : run.status === 'failed' ? `<div class="result-error">${icon('warning')}<h3>This run needs attention</h3><p>${escape(run.error || 'The task could not be completed.')}</p><button class="secondary-button" data-action="run" data-id="${escape(run.taskId)}">${icon('repeat')}Try again</button><button class="secondary-button" data-action="provider-settings">${icon('gear')}Provider settings</button></div>` : `<div class="result-tools"><span>${icon('tray')}Saved to your workspace</span><button class="secondary-button" data-action="copy-result">${icon('copy')}Copy</button><button class="secondary-button" data-action="download-result">${icon('download')}Download</button></div><pre class="result-text">${escape(run.output)}</pre>`}`;
}

document.addEventListener('click', async (event) => {
  const suggestion = event.target.closest('[data-suggestion]');
  if (suggestion) { $('#task-prompt').value = suggestions[Number(suggestion.dataset.suggestion)].prompt; $('#composer-title-row').hidden = false; focusComposer(); return; }
  const filter = event.target.closest('[data-filter]');
  if (filter) {
    state.filter = filter.dataset.filter;
    $$('[data-filter]').forEach((element) => { element.classList.toggle('active', element === filter); element.setAttribute('aria-pressed', String(element === filter)); });
    renderTasks(); return;
  }
  const action = event.target.closest('[data-action]');
  if (!action || action.disabled) return;
  const id = action.dataset.id;
  switch (action.dataset.action) {
    case 'logout':
      action.disabled = true;
      try {
        const response = await fetch('/logout', { method: 'POST', credentials: 'same-origin' });
        if (!response.ok && response.status !== 401) throw new Error('Could not log out. Try again.');
        redirectToLogin();
      } catch (error) { toast(error.message, true); action.disabled = false; }
      break;
    case 'new': focusComposer(); break;
    case 'menu': document.body.classList.add('nav-open'); break;
    case 'close-nav': document.body.classList.remove('nav-open'); break;
    case 'schedule-time': $('#composer-date').hidden = !$('#composer-date').hidden; if (!$('#composer-date').hidden) $('#task-date').focus(); break;
    case 'clear-time': $('#task-date').value = ''; $('#composer-date').hidden = true; break;
    case 'reset-filters': state.search = ''; $('#task-search').value = ''; $('[data-filter="all"]').click(); break;
    case 'refresh-history': action.disabled = true; await refresh(); action.disabled = false; break;
    case 'check-status': action.disabled = true; await refresh(); toast(state.status?.providerConfigured ? 'AI provider variables are configured. Run a task to check access.' : 'Provider still needs setup. Set server variables and restart.', !state.status?.providerConfigured); action.disabled = false; break;
    case 'provider-settings': $('#result-dialog').close(); $('#task-dialog').close(); location.hash = 'settings'; changeView('settings'); break;
    case 'edit': openTask(id); break;
    case 'close-task': $('#task-dialog').close(); break;
    case 'close-result': $('#result-dialog').close(); break;
    case 'confirm-delete': $('#delete-confirm').hidden = false; $('[data-action="delete"]').focus(); break;
    case 'cancel-delete': $('#delete-confirm').hidden = true; break;
    case 'delete':
      action.disabled = true;
      try { await api(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }); $('#task-dialog').close(); toast('Task deleted.'); await refresh(); }
      catch (error) { $('#edit-error').textContent = error.message; $('#edit-error').hidden = false; action.disabled = false; }
      break;
    case 'run': await runTask(id); break;
    case 'result': openResult(id); break;
    case 'copy-result':
      try { await navigator.clipboard.writeText(state.runs.find((run) => run.id === state.runId)?.output || ''); toast('Result copied.'); }
      catch { toast('Copy is unavailable. Select the result text to copy it.', true); }
      break;
    case 'download-result': {
      const run = state.runs.find((item) => item.id === state.runId);
      const task = state.tasks.find((item) => item.id === run.taskId);
      const blobUrl = URL.createObjectURL(new Blob([run.output], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a'); link.href = blobUrl; link.download = `${(task?.title || 'orbit-result').replace(/[^a-z0-9 -]/gi, '').slice(0, 60) || 'orbit-result'}.txt`; link.click(); setTimeout(() => URL.revokeObjectURL(blobUrl), 1000); toast('Result downloaded.'); break;
    }
  }
});
window.addEventListener('hashchange', () => { changeView(location.hash.slice(1)); refresh({ quiet: true }); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') document.body.classList.remove('nav-open');
  if (event.key.toLowerCase() === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.target.closest('input, textarea, select, [contenteditable], dialog') && !$$('dialog').some((item) => item.open)) { event.preventDefault(); focusComposer(); }
});
$$('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
});
$('#task-dialog').addEventListener('close', () => { state.taskId = null; });
$('#result-dialog').addEventListener('close', () => { state.runId = null; });
changeView(location.hash.slice(1));
refresh();
setInterval(() => { if (!document.hidden) refresh({ quiet: true }); }, 7000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh({ quiet: true }); });
