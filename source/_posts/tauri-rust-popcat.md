---
title: Tauri + Rust 实战：把 Windows 回收站改成啵啵猫
date: 2024-11-05 22:41:01
categories:
  - Rust
tags:
  - Rust
  - Tauri
  - Windows
  - Vue
description: 用 Tauri 做一个替换 Windows 回收站图标的小工具，涉及 CLSID、DefaultIcon 注册表项、图标 DLL 释放和 Explorer 刷新。
---

这个项目的目标是把 Windows 回收站的图标换成啵啵猫。选择它主要是想找一个具体场景练习 Tauri，同时了解一下 Windows Shell 图标的配置方式。项目使用 Tauri 1.4、Vue 3 和 TypeScript，Rust 侧负责注册表和文件操作。

<!-- more -->

## 回收站图标与 CLSID

我原本以为换图标是替换一张图片，查过资料后才知道回收站不是普通快捷方式，而是由 Shell 通过 CLSID 管理的对象。它的图标配置位于当前用户的注册表下：

```text
HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\CLSID\
  {645FF040-5081-101B-9F08-00AA002F954E}\DefaultIcon
```

这个键下有 `empty` 和 `full` 两个值，格式是 `文件路径,图标索引`，负数索引表示按资源 ID 取图标。系统默认指向 `imageres.dll` 中的两个图标。也就是说，要替换图标，需要提供一个带图标资源的 DLL，而不是 png 或 ico 文件。

## 图标 DLL 与权限

我做了两个约 66KB 的 DLL，各放入一个图标，使用 `resource` crate 在编译期嵌入可执行文件。运行时将它们释放到 `C:\cat_empty.dll` 和 `C:\cat_full.dll`，再把注册表值改成这两个路径。

选择根目录是为了省事：路径固定，注册表里可以直接写死，不需要处理用户目录展开。代价是写入 `C:\` 需要管理员权限。程序启动时会尝试释放文件，写成功说明有权限，失败则让前端提示以管理员身份运行。这样权限问题在启动阶段就能暴露，而不是等用户点击按钮后才报错。

## 刷新 Explorer

修改注册表后，桌面不会立刻更新，因为 Explorer 会缓存图标。项目采用的刷新方式是结束 `explorer.exe` 再重新启动。这个办法比较直接，会关闭所有资源管理器窗口，任务栏也会短暂消失。执行时给 `cmd.exe` 设置了 `CREATE_NO_WINDOW`，避免出现控制台窗口。

## 界面与命令

前端只有两张图片：点击猫切换到啵啵猫图标，点击回收站恢复默认。Rust 侧注册了三个命令，图形界面和命令行模式共用 `pop_cat` 函数。Tauri 的 `allowlist` 被全部关闭，只保留了 `shell.open`。

## 测试中发现的问题

测试过程中发现了两个问题。一个是命令行模式：释放 DLL 的逻辑只挂在图形界面的命令里，如果在一台从未打开过界面的机器上直接执行 `rust_pop_cat.exe 1`，注册表会指向两个不存在的文件，回收站图标变成空白。另一个是权限检查只判断了第一个文件的写入结果，第二个文件写入失败时仍然返回成功，界面会显示权限正常，但回收站的 `full` 图标没有落地。

## 恢复默认

恢复默认的顺序是先写回 `imageres.dll,-55` 和 `-54`，重启 Explorer，再删除两个 DLL。如果用户安装过其他回收站美化工具，写回默认值会覆盖对方的配置，这类工具之间是互斥的。

## 项目范围

这个项目涉及的环节包括 CLSID、`DefaultIcon` 的路径索引格式、资源内嵌、提权判断、Explorer 刷新和 Tauri 的命令桥接。代码量不大，但把几个原本分散的 Windows 概念串了起来。
