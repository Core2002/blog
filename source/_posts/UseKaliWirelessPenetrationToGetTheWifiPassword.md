---
title: 使用Kali无线渗透获取WiFi密码

date: 2020-02-15 02:55:52
tags:
- Kali
categories:
- 学习
typora-root-url: UseKaliWirelessPenetrationToGetTheWifiPassword
---

> 仅供学习与交流，切勿对真实目标操作，否则后果自负！

# 前期准备：

在虚拟机Kali中是无法直接使用物理机本身的网卡的，需要自己买一块网卡插上去让Kali使用，而且对于网卡的类型也是有限制的，买得不好的话就用不了又得退货。本人在这用的无线网卡型号为`EP-N8508GS`，仅供参考。

# Fighting：

先将无线网卡插入Kali Linux，输入`iwconfig`命令查看得到，网卡名为`wlan0`：
![img](20170802215316131-1581710292501.png)

接着通过以下命令将可能会影响进行无线实验的因素排除掉：
![img](20170802215328854-1581710292745.png)

接着启动`monitor`模式：
![img](20170802215338473-1581710292744.png)

输入`iwconfig`命令确认一遍，确实已进入`monitor`模式：
![img](20170802215350265-1581710292556.png)

接着，输入`airodump-ng wlan0mon`命令来进行抓包：
![img](20170802215400518-1581710292743.png)

在这里选择对加密类型为`WPA`的`Tenda_490298`进行抓包，可看到其BSSID为`C8:3A:35:49:02:98`，CH即信道为`4`。


接着输入`airodump-ng wlan0mon --bssid C8:3A:35:49:02:98 -c 4 -w wpa`只抓取该WPA的数据包：
![img](20170802215413958-1581710292740.png)

可以看到，有三台设备连接到该路由WiFi，应该是手机，接着提示已经抓到了4步握手信息，然后可以关闭抓取。

上面可能是因为有个室友刚好去连WiFi而不是一直都连着吧，所以直接就可以看到。

若抓不到4步握手，则通过以下命令断开设备与WiFi的连接，使其重新建立连接从而可以抓取四步握手信息：
```bash
aireplay-ng -0 2 -a 52:A5:89:BA:57:B3 -c 68:3E:34:A1:F7:27 wlan0mon
```

通过`ls wpa*`命令查看抓到的信息保存的文件（多的wpa包是之前做测试保存下来的）：
![img](20170802215956812-1581710292746.png)

这里看最新的那个即`wpa-04`即可，可以看到总共有4个。

后面使用Kali Linux中默认存在的字典，目录为`/usr/share/wordlists/rockyou.txt.zip`，其中需要使用命令来解压：
![img](20170802220104192-1581710292747.png)

这里顺便记录一下Kali中几个常用的字典文件的位置：
```bash
/usr/share/john/password.lst
/usr/share/wfuzz/wordlist
/usr/share/wordlists
```

然后使用命令`aircrack-ng -w /usr/share/wordlists/rockyou.txt wpa-04.cap`进行破解：

![img](20170802220117307-1581710292747.png)

可以看到，破解成功，密码为`11223344`

没到两秒钟的时间就暴破出WiFi密码，这个弱口令是一个室友当初想方便一点就弄的这个，后面赶紧改了个复杂的。

最后注意的是，WPA和WEP不同（具体的可以百度），如果在字典中没有对应的口令，换句话说，只要WiFi密码设置得够复杂、在口令字典文件中不存在，那么就别指望爆破出密码了。可以看出，也是需要点运气的~

> 原文链接：https://blog.csdn.net/ski_12/article/details/76598873