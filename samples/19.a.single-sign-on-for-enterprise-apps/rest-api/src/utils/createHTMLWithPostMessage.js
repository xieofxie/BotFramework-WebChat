module.exports = (data, origin) =>
  `<!DOCTYPE html><html><head><title></title><script>opener.postMessage('${new URLSearchParams(
    data
  )}', '${origin}');close();</script></head><body></body></html>`;
