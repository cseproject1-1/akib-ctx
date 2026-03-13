document.getElementById('clipBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Scraping page...';
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    statusEl.textContent = 'Error: No active tab found.';
    return;
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const title = document.title;
        const url = window.location.href;
        const content = document.body.innerText;
        const html = document.documentElement.outerHTML;
        return { title, url, content, html };
      }
    });

    statusEl.textContent = 'Processing with AI...';

    // Call the CtxNote Worker API (Localhost for dev, or production URL)
    const response = await fetch('https://ctxnote-worker.yourdomain.workers.dev/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    });

    if (!response.ok) throw new Error('Failed to process page');

    const data = await response.json();
    statusEl.textContent = 'Saved! Opening CtxNote...';

    // Open CtxNote with the clipped content
    // We'll use a local storage or pass via URL for now (Lite version)
    const baseUrl = 'http://localhost:5173'; // Change to production URL later
    const params = new URLSearchParams({
      type: 'clip',
      title: data.title || result.title,
      content: data.summary || result.content.substring(0, 1000),
      url: result.url
    });
    
    window.open(`${baseUrl}/import?${params.toString()}`, '_blank');
    window.close();

  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
    console.error(err);
  }
});
