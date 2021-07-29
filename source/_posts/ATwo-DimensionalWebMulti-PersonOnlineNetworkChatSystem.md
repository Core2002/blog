---
title: 一款二次元的Web多人在线网络聊天系统：Fiora安装及使用
typora-copy-images-to: ATwo-DimensionalWebMulti-PersonOnlineNetworkChatSystem
date: 2020-02-15 04:05:21
tags:
- 转载
- Linux
- 搭建教程
categories:
- 学习
---

**说明：**`Fiora`是一款偏二次元的`Web`多人在线聊天应用，使用`Node.js`、`Mongodb`、`Socket.io`和`React`编写，使用起来还行，挺简洁的，这里水个搭建教程，有兴趣的可以玩玩。

## 截图

[![截图](ATwo-DimensionalWebMulti-PersonOnlineNetworkChatSystem/Fiora(1).png)](https://www.moerats.com/usr/picture/Fiora(1).png)
[![截图](ATwo-DimensionalWebMulti-PersonOnlineNetworkChatSystem/Fiora(2).png)](https://www.moerats.com/usr/picture/Fiora(2).png)

## 功能

- 好友，群组，私聊，群聊
- 文本，图片，代码，`url`等多种类型消息
- 贴吧表情，滑稽表情，搜索表情包
- 桌面通知，声音提醒，语音播报
- 自定义桌面背景，主题颜色，文本颜色
- 查看在线用户，`@`功能
- 小黑屋禁言

## 手动安装

**Github地址：**https://github.com/yinxin630/fiora

**所需环境：**`Nodejs >= 8.9.0`、`Mongodb`。

**说明：**`512M`内存`vps`可能还需要先加一点虚拟内存，不然构建过程会失败，可以使用`Swap`一键脚本→[传送门](https://www.moerats.com/archives/722/)。

**1、安装Nodejs**

```
#Debian/Ubuntu系统
curl -sL https://deb.nodesource.com/setup_10.x | bash -
apt install -y git nodejs 

#CentOS系统
curl -sL https://rpm.nodesource.com/setup_10.x | bash -
yum install nodejs git -y
```

**2、安装Mongodb**

```
#CentOS 6系统，将下面命令一起复制进SSH客户端运行
cat <<EOF > /etc/yum.repos.d/mongodb.repo
[mongodb-org-4.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/6/mongodb-org/4.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-4.0.asc
EOF
yum -y install mongodb-org

#CentOS 7系统，将下面命令一起复制进SSH客户端运行
cat <<EOF > /etc/yum.repos.d/mongodb.repo
[mongodb-org-4.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/7/mongodb-org/4.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-4.0.asc
EOF
yum -y install mongodb-org

#Debian 8系统
apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
echo "deb http://repo.mongodb.org/apt/debian jessie/mongodb-org/4.0 main" | tee /etc/apt/sources.list.d/mongodb-org-4.0.list
apt update -y
apt install -y mongodb-org

#Debian 9系统
curl https://www.mongodb.org/static/pgp/server-4.0.asc | apt-key add -
echo "deb http://repo.mongodb.org/apt/debian stretch/mongodb-org/4.0 main" | tee /etc/apt/sources.list.d/mongodb-org-4.0.list
apt-get update -y
apt-get install -y mongodb-org

#Debian 10系统
curl https://www.mongodb.org/static/pgp/server-4.2.asc | apt-key add -
echo "deb http://repo.mongodb.org/apt/debian buster/mongodb-org/4.2 main" | tee /etc/apt/sources.list.d/mongodb-org-4.2.list
apt update -y
apt install -y mongodb-org

#Ubuntu 16.04系统
apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
echo "deb https://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/4.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-4.0.list
apt update -y
apt install -y mongodb-org

#Ubuntu 18.04、18.10、19.04系统
apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
echo "deb https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-4.0.list
apt update -y
apt install -y mongodb-org
```

如果导入公匙时出现`gnupg, gnupg2 and gnupg1 do not seem to be installed`错误，使用`apt install -y gnupg2`，然后重新导入即可。

启动`Mongodb`并设置开机自启：

```
#CentOS 6系统
service mongod start
chkconfig mongod on

#CentOS 7、Debian、Ubuntu系统
systemctl start mongod
systemctl enable mongod
```

**3、安装fiora**

```
#拉取源码并存放于/opt文件夹
git clone https://github.com/yinxin630/fiora.git -b master /opt/fiora
cd /opt/fiora
#安装依赖，这里不能用npm，需要用yarn来安装
npm i -g yarn
yarn
#构建
npm run build
#转移产物
npm run move-dist
#启动
npm start
```

运行后打开`ip:9200`，注册一个账号，然后可以看`SSH`客户端运行日志，获取自己的`userId`。

```
#这里注册或登录的时候返回的信息，后面的5d329dd354b9则为自己的userId
<-- getLinkmansLastMessages  mYNheu93jds7 5d329dd354b9
```

如果`ip:9200`打不开的，可以检查下防火墙，`CentOS`系统可以使用以下命令：

```
#CentOS 6
iptables -I INPUT -p tcp --dport 9200 -j ACCEPT
service iptables save
service iptables restart

#CentOS 7
firewall-cmd --zone=public --add-port=9200/tcp --permanent
firewall-cmd --reload
```

像阿里云等，还需要额外在安全组开放端口。

接下来再将自己的账号设置成管理员，先使用`Ctrl+C`断开运行。

新建`Systemd`配置文件，只适用于`CentOS 7`、`Debian 8+`、`Ubuntu 16+`等。

```
#先修改你的userId和运行端口后复制到SSH运行
Administrator=5d329dd354b9
Port=9200
#新建fiora用户并授权
useradd -M fiora && usermod -L fiora
chown -R fiora:fiora /opt/fiora
#新建systemd配置文件，将以下代码一起复制到SSH运行
cat > /etc/systemd/system/fiora.service <<EOF
[Unit]
Description=fiora
After=network.target
Wants=network.target

[Service]
Type=simple
PIDFile=/var/run/fiora.pid
ExecStart=$(command -v npm) start
WorkingDirectory=/opt/fiora
Environment=Administrator=$Administrator Port=$Port
User=fiora
Restart=on-failure
RestartSec=42s

[Install]
WantedBy=multi-user.target
EOF
```

开始启动并设置开机自启：

```
systemctl start fiora
systemctl enable fiora
```

其它系统，比如`CentOS`、`Debian 7`等系统，可以直接使用以下方法启动：

```
#管理员userId和运行端口自行修改
export Administrator=5d329dd354b9 Port=9200
nohup npm start &
```

此时就可以访问`ip:9200`，运行端口以你设置的为准，这时候你登陆的时候，会发现左侧多了个管理员图标。

**4、域名反代**
如果你想使用域名的话，这里依旧使用`Caddy`反代，操作如下：

安装`Caddy`：

```
wget -N --no-check-certificate https://raw.githubusercontent.com/ToyoDAdoubiBackup/doubi/master/caddy_install.sh && chmod +x caddy_install.sh && bash caddy_install.sh
#备用地址
wget -N --no-check-certificate https://www.moerats.com/usr/shell/Caddy/caddy_install.sh && chmod +x caddy_install.sh && bash caddy_install.sh
```

配置`Caddy`：

```
#以下全部内容是一个整体，请修改域名后一起复制到SSH运行！

#http访问，该配置不会自动签发SSL
echo "www.moerats.com {
 gzip
 proxy / 127.0.0.1:9200 {
    websocket
    header_upstream Host {host}
    header_upstream X-Real-IP {remote}
    header_upstream X-Forwarded-For {remote}
    header_upstream X-Forwarded-Port {server_port}
    header_upstream X-Forwarded-Proto {scheme}
  }
}" > /usr/local/caddy/Caddyfile

#https访问，该配置会自动签发SSL，请提前解析域名到VPS服务器
echo "www.moerats.com {
 gzip
 tls admin@moerats.com
 proxy / 127.0.0.1:9200 {
    websocket
    header_upstream Host {host}
    header_upstream X-Real-IP {remote}
    header_upstream X-Forwarded-For {remote}
    header_upstream X-Forwarded-Port {server_port}
    header_upstream X-Forwarded-Proto {scheme}
  }
}" > /usr/local/caddy/Caddyfile
```

`tls`参数会自动帮你签发`ssl`证书，如果你要使用自己的`ssl`，改为`tls /root/xx.crt /root/xx.key`即可。后面为`ssl`证书路径。

启动`Caddy`：

```
/etc/init.d/caddy start
```

就可以打开域名进行访问了。

如果你想修改默认的频道名称的话，可以编辑`config/server.js`文件，修改最下面的代码：

```
defaultGroupName: 'fiora',
```

然后重启应用即可。需要使用到七牛云`CDN`的，可以参考作者给的教程自行设置→[传送门](https://github.com/yinxin630/fiora/blob/master/doc/INSTALL.ZH.md)

## 宝塔安装

**1、安装宝塔**

```
#CentOS系统
wget -O install.sh http://download.bt.cn/install/install_6.0.sh && sh install.sh
#Ubuntu系统
wget -O install.sh http://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh
#Debian系统
wget -O install.sh http://download.bt.cn/install/install-ubuntu_6.0.sh && bash install.sh
```

安装完成后，进入面板，点击左侧软件商店，然后安装`PM2管理器`、`MongoDB`、`Nginx`(使用域名访问才需要安装，反之不用)。

注意：`Debian`安装`MongoDb`之前还需要使用命令`apt install sudo`，不然可能存在`MongoDb`启动不了的情况；如果你已经安装了`MongoDb`，那就先使用`apt install sudo`，再使用`/etc/init.d/mongodb start`启动即可。

**2、安装fiora**
该步骤参考上面的手动步骤`3`，区别在于新建`systemd`配置文件的时候，`Environment`参数还需要加一样，不然启动可能失败。

只需要把新建`systemd`配置文件步骤换成下面这个，其它一模一样。

```
#先给node做个软连接，不然后面会启动失败
ln -sf $(which node) /usr/bin/node
#修改运行端口，可以默认
Port=9200
#以下命令一起复制进SSH客户端运行
cat > /etc/systemd/system/fiora.service <<EOF
[Unit]
Description=fiora
After=network.target
Wants=network.target

[Service]
Type=simple
PIDFile=/var/run/fiora.pid
ExecStart=$(command -v npm) start
WorkingDirectory=/opt/fiora
Environment=NODE_ENV=production Administrator=$Administrator Port=$Port
User=fiora
Restart=on-failure
RestartSec=42s

[Install]
WantedBy=multi-user.target
EOF
```

**3、域名反代**
先点击左侧网站，添加站点，然后再点击添加好了的域名名称，这时候就进入了站点配置，点击配置文件，在中间添加以下代码：

```
location / {
    proxy_pass http://127.0.0.1:9200;
    proxy_set_header Host             $host;
    proxy_set_header X-Real-IP        $remote_addr;
    proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forward-Proto http;
    proxy_set_header X-Nginx-Proxy true;
    proxy_http_version 1.1;

    proxy_redirect off;
}
```

其它的就自己慢慢摸索吧，博主也没过多使用，有问题可以直接去`Github Issues`反馈。

------

> 版权声明：本文为原创文章，版权归 [Rat's Blog](https://www.moerats.com/) 所有，转载请注明出处！
>
> 本文链接：https://www.moerats.com/archives/978/