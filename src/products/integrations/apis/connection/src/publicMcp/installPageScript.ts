export let publicMcpInstallScript = `
let buttons = document.querySelectorAll('[data-client]');

let panels = document.querySelectorAll('[data-client-panel]');

let announcement = document.querySelector('#announcement');

let showClient = id => {
  buttons.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.client === id));
  });

  panels.forEach(panel => {
    panel.hidden = panel.dataset.clientPanel !== id;
  });
};

buttons.forEach(button => {
  button.addEventListener('click', () => {
    showClient(button.dataset.client);
    announcement.textContent = 'Showing ' + button.textContent.trim() + ' setup instructions.';
  });
});

document.querySelectorAll('[data-copy]').forEach(button => {
  button.addEventListener('click', async () => {
    let target = button.dataset.copy === 'endpoint'
      ? document.querySelector('#endpoint')
      : button.closest('.code-box').querySelector('code');
    let previous = button.textContent;

    try {
      await navigator.clipboard.writeText(target.textContent);
      button.textContent = 'Copied';
      announcement.textContent = 'Copied to clipboard.';
    } catch {
      let range = document.createRange();
      range.selectNodeContents(target);

      let selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }

      button.textContent = 'Select Text';
      announcement.textContent = 'Text selected. Use your keyboard to copy.';
    }

    setTimeout(() => { button.textContent = previous; }, 1800);
  });
});

showClient('cursor');
`;
