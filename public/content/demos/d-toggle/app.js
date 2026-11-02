const toggle = document.querySelector('.toggle');
const label = toggle.querySelector('.label');

toggle.addEventListener('click', () => {
  const on = toggle.getAttribute('aria-checked') !== 'true';
  toggle.setAttribute('aria-checked', String(on));
  label.textContent = on ? 'On' : 'Off';
});
