const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const IGNORE_DIRS = new Set(['.git', 'node_modules']);

function listTopLevelSegments() {
  const entries = fs.readdirSync(repoRoot, { withFileTypes: true });
  return entries
    .filter((entry) => !IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.'))
    .filter((entry) => entry.isDirectory() || entry.name.endsWith('.html'))
    .map((entry) => entry.name)
    .sort();
}

function walk(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

function ensureAttribute(content, attribute, value) {
  const attrPattern = new RegExp(`${attribute}="[^"]*"`);
  if (attrPattern.test(content)) {
    return content.replace(attrPattern, `${attribute}="${value}"`);
  }
  return content.replace('<html', `<html ${attribute}="${value}"`);
}

function applyBasePath(htmlPath, options) {
  const relative = path.relative(repoRoot, htmlPath);
  const isAdmin = relative === 'admin/index.html' || relative === path.join('src', 'admin', 'index.html');
  const knownRootsValue = options.knownRoots.join(',');

  let content = fs.readFileSync(htmlPath, 'utf8');

  content = ensureAttribute(content, 'data-base-path', 'auto');
  content = ensureAttribute(content, 'data-known-roots', knownRootsValue);

  if (isAdmin) {
    const adminPattern = /<script type="module" src="\/admin\/preview-templates\/index.js"><\/script>/;
    const adminReplacement = `<script>(function(){var d=document;var attr=d.documentElement.getAttribute("data-base-path");var base="/";var knownAttr=d.documentElement.getAttribute("data-known-roots");var known=knownAttr?knownAttr.split(","):[];if(attr&&attr!=="auto"){base=attr;}else{var segments=location.pathname.split("/").filter(Boolean);if(segments.length&&known.indexOf(segments[0])===-1){base="/"+segments[0]+"/";}}if(base.slice(-1)!=="/"){base+="/";}window.__BASE_PATH__=base;var script=d.createElement("script");script.type="module";script.src=base+"admin/preview-templates/index.js";d.head.appendChild(script);}());</script>`;
    if (adminPattern.test(content)) {
      content = content.replace(adminPattern, adminReplacement);
    }
  } else {
    const headPattern = /<link rel="stylesheet" href="\/assets\/css\/main.css"><script async="async" src="\/assets\/js\/main.bundle.js"><\/script>/;
    const headReplacement = `<script>(function(){var d=document;var attr=d.documentElement.getAttribute("data-base-path");var base="/";var knownAttr=d.documentElement.getAttribute("data-known-roots");var known=knownAttr?knownAttr.split(","):[];if(attr&&attr!=="auto"){base=attr;}else{var segments=location.pathname.split("/").filter(Boolean);if(segments.length&&known.indexOf(segments[0])===-1){base="/"+segments[0]+"/";}}if(base.slice(-1)!=="/"){base+="/";}window.__BASE_PATH__=base;var baseEl=d.createElement("base");baseEl.href=base;d.head.appendChild(baseEl);var link=d.createElement("link");link.rel="stylesheet";link.href=base+"assets/css/main.css";d.head.appendChild(link);var script=d.createElement("script");script.async=true;script.src=base+"assets/js/main.bundle.js";d.head.appendChild(script);}());</script><noscript><link rel="stylesheet" href="/assets/css/main.css"></noscript>`;
    if (headPattern.test(content)) {
      content = content.replace(headPattern, headReplacement);
    }

    const footerScript = `<script>(function(){var base=window.__BASE_PATH__||"/";if(base==="/"){return;}var normalized=base.replace(/\/\/+$/,""),anchors=document.querySelectorAll("a[href^='/']");for(var i=0;i<anchors.length;i++){var href=anchors[i].getAttribute("href");if(!href||href[0]!=='/'||href[1]==='/'){continue;}if(href==="/"){anchors[i].setAttribute("href",base);continue;}if(href[1]==="#"){anchors[i].setAttribute("href",base+href.slice(1));continue;}anchors[i].setAttribute("href",normalized+href);}var forms=document.querySelectorAll("form[action^='/']");for(var j=0;j<forms.length;j++){var action=forms[j].getAttribute("action");if(!action||action[0]!=='/'||action[1]==='/'){continue;}if(action==="/"){forms[j].setAttribute("action",base);continue;}forms[j].setAttribute("action",normalized+action);} }());</script>`;
    if (!content.includes(footerScript)) {
      if (!content.includes('</body></html>')) {
        console.warn('No closing tags for', relative);
      }
      content = content.replace('</body></html>', `${footerScript}</body></html>`);
    }
  }

  fs.writeFileSync(htmlPath, content);
}

function main() {
  const knownRoots = listTopLevelSegments();
  const htmlFiles = walk(repoRoot);
  for (const file of htmlFiles) {
    applyBasePath(file, { knownRoots });
  }
}

if (require.main === module) {
  main();
}
