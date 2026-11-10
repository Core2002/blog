'use strict';

// Rewrite relative post-asset image paths, replacing hexo-asset-image.
// Kept intentionally small: it only inspects <img src="..."> attributes and
// avoids pulling in a DOM parser / cheerio.

function getPosition(str, m, i) {
  return str.split(m, i).join(m).length;
}

hexo.extend.filter.register('after_post_render', function(data) {
  const config = hexo.config;
  if (!config.post_asset_folder || !data.permalink) return data;

  const link = data.permalink;
  const beginPos = getPosition(link, '/', 3) + 1;
  let appendLink = '';
  let endPos = link.length - 1;

  if (/.*\/index\.html$/.test(link)) {
    appendLink = 'index/';
    endPos = link.lastIndexOf('/');
  }

  const base = link.substring(beginPos, endPos) + '/' + appendLink;

  for (const key of ['excerpt', 'more', 'content']) {
    if (!data[key]) continue;

    data[key] = data[key].replace(/<img\b[^>]*>/gi, function(tag) {
      const match = /\bsrc="([^"]*)"/i.exec(tag);
      if (!match) return tag;

      let src = match[1].replace(/\\/g, '/');

      if (/^https?:\/\//i.test(src) || /^\/\//.test(src) ||
          /^\s+\//.test(src) || /^\s*\/uploads|images\//.test(src)) {
        return tag;
      }

      const srcArray = src.split('/').filter(function(elem) {
        return elem !== '' && elem !== '.';
      });
      if (srcArray.length > 1) srcArray.shift();

      src = srcArray.join('/');
      return tag.replace(match[0], 'src="' + config.root + base + src + '"');
    });
  }

  return data;
});
