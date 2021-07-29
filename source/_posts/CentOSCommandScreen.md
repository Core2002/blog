---
title: 命令：Screen
typora-copy-images-to: CentOSCommandScreen
date: 2020-02-15 04:14:48
tags:
- 转载
- Linux
categories:
- 学习
---

## 摘要

> 作为运维人员经常会遇到等到远程主机的链接因为网络原因或者别的其他不可抗拒的原因断掉，此时远程为执行完成的命令也会断掉而导致很多任务需要重新执行。

> 这给大家介绍一个在这种情况下很好用的命令 `screen`，具体好用在那里，下面具体介绍，包括从其安装到配置到使用

## What to do

在正式介绍之前，先给大家介绍下 `screen` 都能做什么事情

- 通过一个SSH session使用多个shell窗口
- 即使网络断开链接也能保持shell窗口处理激活状态
- 可以在任何地方断开或者重连同一个shell session
- 不用为了跑一个耗时的任务而长时间保持几个shell session处于激活状态

------

## 安装

Centos下命令安装一般都采用两种方式，YUM和RPM包的方式。这里分别介绍

### YUM安装



```undefined
yum install -y screen
```

### RPM安装

对于下载 RPM 包，建议去 [http://rpm.pbone.net/](https://link.jianshu.com?t=http://rpm.pbone.net/) 下载



```cpp
wget ftp://bo.mirror.garr.it/1/slc/centos/7.1.1503/os/x86_64/Packages/screen-4.1.0-0.19.20120314git3c2946.el7.x86_64.rpm
rpm -ivh screen-4.1.0-0.19.20120314git3c2946.el7.x86_64.rpm
```

## 验证安装



```ruby
root@pts/1 $ which screen
/usr/bin/screen

root@pts/1 $ screen -v
Screen version 4.01.00devel (GNU) 2-May-06
```

------

## 使用

### screen

在开始使用 `screen` 之前，执行下面的命令



```css
root@pts/1 $ ps -ef|grep screen
root      6297  2410  0 14:02 pts/1    00:00:00 grep --color=auto screen
```

然后输入 `screen` 回车，感觉打开了一个新的shell session

### screen -list

这个时候我们在执行上面的`ps`命令和`screen -list`查看结果



```shell
root@pts/2 $ ps -ef|grep screen
root      6335  2410  0 14:02 pts/1    00:00:00 screen
root      6476  6337  0 14:02 pts/2    00:00:00 grep --color=auto screen

root@pts/2 $ screen -list
There is a screen on:
        6336.pts-1.192  (Attached)
1 Socket in /var/run/screen/S-root.
```

`screen -list`是查看开启的screen列表

### 新增screen `ctrl+a+c`

为了验证新增screen和后面的功能，在上面的开启的第一个screen session中执行`top`命令

从当前的screen session开启一个新的screen session可以使用快捷键 `ctrl+a+c`

看到开启了一个新的 screen session，一个没有执行`top`的新session

### screen切换 ctrl+a+n/p



```undefined
ctrl+a+n 切换到下一个

ctrl+a+p 切换到上一个
```

需要说明的是在切换的时候N多session组成一个`类似环状`，ctrl+a+n切换到最后一个之后在切换久切换到了第一个，

同理ctrl+a+p切换到第一个之后在切换久切换到了最后一个screen session

### 离开screen ctrl+a+d

注意括号中的状态值，由`Attached`变成`Detached`



```csharp
[detached from 6336.pts-1.192]

root@pts/1 $ screen -list
There is a screen on:
    6336.pts-1.192  (Detached)
1 Socket in /var/run/screen/S-root.
```

### 再连接到screen ctrl+r[+name]

当系统只有一个screen处于 Detached状态的话，直接输入`ctrl+r`回车就可以进入screen

如果有多个



```dart
root@pts/1 $ screen -list
There are screens on:
        9944.lc (Detached)
        9766.pts-1.192  (Detached)
        6336.pts-1.192  (Detached)
3 Sockets in /var/run/screen/S-root.
```

就需要执行`ctrl+r+9766.pts-1.192`

这里其实输入前面的数字或者后面的字符串都行，比如



```css
ctrl+r+6336
ctrl+r+pts-1.192
pts-1.192` 是由系统生成的，对应用户而言没有明确的意义。我们可以通过`screen -S lc` 命令去自定义这个值，结果如上面的`9944.lc
```

## 锁住screen ctrl+a+x



```csharp
Screen used by root <root> on 192.
Password:  
```

使用的时候输入密码即可

## 停止screen exit or ctrl+a+k

当你跑完脚本或者执行完任务的时候，一般建议`停止screen`，也就是`真正的退出screen`

