---
title: hexo引用本地图片无法显示
typora-copy-images-to: hexo引用本地图片无法显示
date: 2020-02-15 03:39:30
categories:
- Bugs
tags:
- Hexo
- 转载
typora-root-url: HexoReferencesToLocalImagesCannotBeDisplayed
---

最近重新开始用起hexo，但是发现在文章中引用本地图片时总是显示不出来。
花费了许久时间才解决这个问题。
因此将一些解决经验整理出来，希望能帮助到大家。

# 一、插件安装与配置

## 首先我们需要安装一个图片路径转换的插件，这个插件名字是hexo-asset-image
```bash
npm install https://github.com/CodeFalling/hexo-asset-image --save
```

但是这个插件的内容需要修改【不然可能会出Bug】

## 打开/node_modules/hexo-asset-image/index.js，将内容更换为下面的代码

```javascript
'use strict';
var cheerio = require('cheerio');

// http://stackoverflow.com/questions/14480345/how-to-get-the-nth-occurrence-in-a-string
function getPosition(str, m, i) {
    return str.split(m, i)
        .join(m)
        .length;
}

var version = String(hexo.version)
    .split('.');
hexo.extend.filter.register('after_post_render', function(data) {
    var config = hexo.config;
    if (config.post_asset_folder) {
        var link = data.permalink;
        if (version.length > 0 && Number(version[0]) == 3)
            var beginPos = getPosition(link, '/', 1) + 1;
        else
            var beginPos = getPosition(link, '/', 3) + 1;
        // In hexo 3.1.1, the permalink of "about" page is like ".../about/index.html".
        var endPos = link.lastIndexOf('/') + 1;
        link = link.substring(beginPos, endPos);

        var toprocess = ['excerpt', 'more', 'content'];
        for (var i = 0; i < toprocess.length; i++) {
            var key = toprocess[i];

            var $ = cheerio.load(data[key], {
                ignoreWhitespace: false,
                xmlMode: false,
                lowerCaseTags: false,
                decodeEntities: false
            });

            $('img')
                .each(function() {
                    if ($(this)
                        .attr('src')) {
                        // For windows style path, we replace '\' to '/'.
                        var src = $(this)
                            .attr('src')
                            .replace('\\', '/');
                        if (!/http[s]*.*|\/\/.*/.test(src) &&
                            !/^\s*\//.test(src)) {
                            // For "about" page, the first part of "src" can't be removed.
                            // In addition, to support multi-level local directory.
                            var linkArray = link.split('/')
                                .filter(function(elem) {
                                    return elem != '';
                                });
                            var srcArray = src.split('/')
                                .filter(function(elem) {
                                    return elem != '' && elem != '.';
                                });
                            if (srcArray.length > 1)
                                srcArray.shift();
                            src = srcArray.join('/');
                            $(this)
                                .attr('src', config.root + link + src);
                            console.info && console.info("update link as:-->" + config.root + link + src);
                        }
                    } else {
                        console.info && console.info("no src attr, skipped...");
                        console.info && console.info($(this));
                    }
                });
            data[key] = $.html();
        }
    }
});
```

# 二、问题推测

## （一）本地图片没有有效上传至github仓库中，导致引用无效

解决方案：安装插件（回看前文）

## （二）本地图片没有存放在同名文件夹中

解决方案：将需要引用的本地图片存放在与文章名相同的文件夹中

## （三）图片路径出错

这也是我出现的问题。

打开F12，发现下图问题。

![](20181115112933605.png)

因为我在github中关于Hexo的仓库名为850552586.github.io，并不是Ericam.com，所以导致了访问无效。

【这个问题可能是因为我更换电脑后重新配置Hexo忽略的地方】

解决方案：打开_config.yml修改下述内容

![](20181115112941162.png)

## （四）相对路径引用的标签插件

通过常规的 markdown 语法和相对路径来引用图片和其它资源可能会导致它们在存档页或者主页上显示不正确。在Hexo 2时代，社区创建了很多插件来解决这个问题。但是，随着Hexo 3 的发布，许多新的标签插件被加入到了核心代码中。这使得你可以更简单地在文章中引用你的资源。

也就是说在存档页和主页不能使用和文章内容中的常规语法来引用图片。

比如说：当你打开文章资源文件夹功能后，你把一个 example.jpg 图片放在了你的资源文件夹中，如果通过使用相对路径的常规 markdown 语法 ![](/example.jpg) ，它将 不会 出现在首页上。（但是它会在文章中按你期待的方式工作）

正确的引用图片方式是使用下列的标签插件而不是 markdown ：

```
{% asset_img example.jpg This is an example image %}
```

浏览地址：Ericam个人博客
配置教程：安装配置Gridea

原创不易，请勿转载。如有问题，可以评论区留言。点赞！

###### ————————————————

版权声明：本文为CSDN博主「Ericam_」的原创文章，遵循 CC 4.0 BY-SA 版权协议，转载请附上原文出处链接及本声明。
原文链接：https://blog.csdn.net/xjm850552586/article/details/84101345