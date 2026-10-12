import { loadRuntimeConfig } from './runtime-config.ts';

const container = document.getElementById('root');
if (!container) throw new Error('Missing application root');

function startupFailure() {
  const main = document.createElement('main');
  main.className = 'startup';
  const title = document.createElement('h1');
  title.textContent = 'This instance could not start';
  const description = document.createElement('p');
  description.setAttribute('role', 'alert');
  description.textContent =
    'Its public configuration is missing or invalid. Ask the instance administrator to check it, then try again.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Try again';
  retry.addEventListener('click', () => window.location.reload());
  main.append(title, description, retry);
  container!.replaceChildren(main);
}

// No API client, Query client or router exists before config is validated.
loadRuntimeConfig()
  .then(async (config) => {
    document.title = config.applicationName;
    const { startApplication } = await import('./app.tsx');
    startApplication(container, config);
  })
  .catch(startupFailure);
