(() => {
  window.__readspaceNativeToken = __READSPACE_PORT_TOKEN__;
  if (window.__readspaceNativeDownloads) return;
  window.__readspaceNativeDownloads = true;
  const style = document.createElement('style'); style.textContent = '.mobile-install-intro{display:none}.mobile-install{grid-template-columns:1fr}'; document.head.append(style);
  let port, busy = false;
  window.addEventListener('message', event => {
    if (event.data !== window.__readspaceNativeToken || !event.ports?.[0]) return;
    port = event.ports[0];
  });
  const exportable = anchor => port && anchor?.hasAttribute('download') && anchor.href.startsWith('blob:' + location.origin + '/');
  const exportBlob = async anchor => {
    if (busy) return;
    busy = true;
    try {
      const blob = await fetch(anchor.href).then(r => r.blob());
      if (blob.size > 10_000_000) throw Error('too-large');
      const reader = new FileReader();
      const data = await new Promise((resolve, reject) => { reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
      port.postMessage(JSON.stringify({name:anchor.download, type:blob.type.split(';')[0], body:data.slice(data.indexOf(',')+1)}));
    } catch { port.postMessage(JSON.stringify({error:true})); }
    finally { busy = false; }
  };
  document.addEventListener('click', event => {
    const anchor = event.target?.closest?.('a');
    if (anchor?.target === '_blank') anchor.target = '_self';
    if (!exportable(anchor)) return;
    event.preventDefault(); event.stopImmediatePropagation(); void exportBlob(anchor);
  }, true);
  // ReadSpace's JSON/CSV/Markdown actions click detached anchors, so they do not
  // bubble through document. Handle that path without exposing a Java interface.
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (exportable(this)) { void exportBlob(this); return; }
    return click.call(this);
  };
})();
