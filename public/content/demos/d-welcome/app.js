const prices = { monthly: ['$12', '/ month'], yearly: ['$120', '/ year'] };
const buttons = document.querySelectorAll('.toggle button');
for (const button of buttons) {
  button.addEventListener('click', () => {
    for (const b of buttons) b.classList.toggle('active', b === button);
    const [amount, unit] = prices[button.dataset.period];
    document.getElementById('amount').textContent = amount;
    document.getElementById('unit').textContent = unit;
  });
}
document.getElementById('cta').addEventListener('click', () => {
  document.getElementById('note').textContent = 'Trial started — this is just a demo.';
});
