'use strict';
globalThis.ChecksumIcons = (() => {
  const paths = {
    power:'M12 3v9M6.3 5.8a8 8 0 1 0 11.4 0',
    settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3ZM15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z',
    report:'M7 3h7l4 4v14H6V3h1Zm7 0v5h4M9 12h6M9 16h6',
    file:'M7 3h7l4 4v14H6V3h1Zm7 0v5h4M8.5 14l2 2 4-4',
    download:'M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5',
    folder:'M3 7V5h7l2 2h9v13H3V7Z',
    close:'m6 6 12 12M18 6 6 18', arrow:'M4 12h15m-6-6 6 6-6 6',
    copy:'M8 8h12v12H8V8ZM4 16V4h12', pause:'M8 4v16M16 4v16',
    play:'m8 4 12 8-12 8V4Z', stop:'M5 5h14v14H5V5Z',
    retry:'M20 11a8 8 0 1 0-2 7M20 4v7h-7',
    trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
    search:'M16 16l5 5M18 10a8 8 0 1 0-16 0 8 8 0 0 0 16 0Z',
    shield:'m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Zm-4 9 3 3 5-6',
    check:'m5 12 4 4L19 6', question:'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17v.1',
    link:'m9 15 6-6M7 14l-2 2a3 3 0 0 0 4 4l3-3M12 7l3-3a3 3 0 0 1 4 4l-2 2'
  };
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    for (const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'18',height:'18',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false',class:'ui-icon'})) svg.setAttribute(key,value);
    const path = document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]||paths.file);svg.append(path);return svg;
  }
  function decorate(button,name,label,only=false) {
    button.querySelector(':scope > .ui-icon')?.remove();
    if (only) { button.replaceChildren(icon(name));button.classList.add('icon-button'); }
    else button.prepend(icon(name));
    if (label) {button.setAttribute('aria-label',label);button.title=label;}
  }
  return Object.freeze({icon,decorate});
})();
