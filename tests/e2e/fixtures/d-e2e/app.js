let n = 0;
document.getElementById('b').addEventListener('click', (e) => {
  e.target.textContent = `Clicked ${++n}`;
});
