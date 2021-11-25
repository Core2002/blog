---
title: hexo博客框架+matery主题搭建以及云服务器部署

categories:
- Linux
tags:
- Hexo
- Linux
- 转载
typora-root-url: hexo
---
### 阅读须知：

- 系统环境：

  > 本机：win10系统
  > 虚拟机：CentOS7-64位（新装的）
  > 云服务器：CentOS7-64位
  > 注意：以下代码中`#`代表root权限，`$`代表普通用户
  >
  > 如果你也跟我一样新装了个虚拟机centos7系统，建议先看看[我的另一篇博客](http://www.nstop.cn/2019/11/25hexo-bo-ke-da-jian/)

### 一、初步搭建hexo环境(注意：我这是在虚拟机中的CentOS7系统上操作)

#### 1、安装git（如果有则无须安装）

先介绍一种简单的方法（直接安装）但这种安装git版本过低
`yum install -y git`
–查看git版本
`git --version`

![img](11-29-08.jpg)

> 这时候你会发现git版本会过低，我这里的是1.8.3.1
> 下面我将介绍最新版本git安装

1. 先卸载旧版本
   ```bash
   $ sudo yum remove -y git
   ```
2. 安装git新版本所需的依赖包
   ```bash
   $ sudo yum install -y curl-devel expat-devel gettext-devel openssl-devel zlib-devel
   $ sudo yum install -y gcc perl-ExtUtils-MakeMaker
   ```

3. 从我的github仓库源中下载最新git安装包并解压到`/usr/local/src`目录下
   ```bash
   $ wget https://mirrors.edge.kernel.org/pub/software/scm/git/git-2.19.0.tar.gz
   $ sudo tar -zxvf git-2.19.0.tar.gz -C /usr/local/src
   ```

   > 如果你的机器上没有安装wget则先安装
   > `sudo yum install -y wget`
   > 这里解释一下 `-y` 这个参数的作用：
   > 无需用户确认要发生的操作（也就是经常会弹出的yes/no/Enter 直接确认跳过）

4. 编译并安装

   ```bash
   $ cd /usr/local/src/git-2.19.0/
   $ sudo make prefix=/usr/local/git all # 编译源码
   $ sudo make prefix=/usr/local/git install #安装到/usr/local/git
   ```

5. 修改配置文件（添加环境变量）

   ```bash
   $ sudo vi /etc/profile
   #在文件末尾添加export PATH=/usr/local/git/bin:$PATH 保存退出
   ```

6. 更新修改过后的配置文件
   ```bash
   $ source /etc/profile
   #查看git版本检查一下是否安装成功
   $ git --version
   ```

7. 顺便添加你的用户和邮箱
   ```bash
   # git config --global user.name "yourname"
   # git config --global user.email "youremail"
   ```

#### 2、安装nodejs

在安装hexo-cli之前需要借助nodejs

1. 去nodejs官网下载Linux二进制64bit压缩包，当然如果你的系统是32位的，即选择32位的，这里我直接用wget命令+ url 直接下载到本系统上
   ```bash
   # wget https://nodejs.org/dist/v12.13.1/node-v12.13.1-linux-x64.tar.xz
   ```

2. 在`/usr/local/`目录下创建一个`nodejs`文件夹
   ```bash
   # mkdir /usr/local/nodejs
   ```

3. 将压缩包解压到`/usr/local/nodejs/`下
   ```bash
   # tar -Jxvf node-v12.13.1-linux-x64.tar.xz -C /usr/local/nodejs
   ```

4. 为nodejs添加环境变量，即将`/usr/local/nodejs/node-v12.13.1-linux-x64/bin`添加到环境变量$PATH中，当然你也可以用创建`软连接`(即windows中的快捷方式)的方式代替，只不过第二种显得有点麻烦

   - 查看一下当前进程的环境变量值
     ```bash
     # echo $PATH
     ```

   - 配置nodejs的环境
     ```bash
     # vi /etc/profile
     ```
     在文件末尾加上：`export PATH=/usr/local/nodejs/node-v12.13.1-linux-x64/bin:$PATH`保存退出并更新profile文件

     ```bash
     # source /etc/profile
     ```

     > 这里提一下为什么要写成PATH=/usr/local/nodejs/node-v12.13.1-linux-x64/bin:$PATH
     > 而不写成PATH=$PATH:/usr/local/nodejs/node-v12.13.1-linux-x64/bin
     > 当执行某个命令时，如果找不到会从环境变量中去查找对应的目录下是否有该命令，而查找则是
     > 按照从左到右的顺序进行查找，所以这就可以避免旧版本在新版本之前而使得新版本不能被应用的情况

   - 再次查看环境变量检查是否添加成功

     ```bash
     # echo $PATH
     ```

5. 查看nodejs版本检查是否安装成功

   ```bash
   # node -v
   # npm -v
   ```

#### 3、安装hexo

接下来用`npm`来安装hexo-cli,但是在这不推荐大家使用，由于安装源在国外，下载过于缓慢，所以我们可以用国内的阿里巴巴镜像源进行快速下载安装

1. npm 安装方式
   ```bash
   # npm install -g hexo-cli
   ```

2. cnpm 安装方式

   ```bash
   # npm install -g cnpm --registry=https://registry.npm.taobao.org
   # cnpm install -g hexo-cli
   ```

3. 查看hexo版本检查是否已安装好

   ```bash
   # hexo -v
   ```

#### 4、用hexo生成博客框架

1. 随便创建一个文件夹，这个文件夹用来存放hexo框架所有文件的（换而言之这个文件夹就是你的博客根目录），然后初始化该文件

   ```bash
   # mkdir myblog
   #这里改一下myblog的所有者和所有组(jake为你自己的用户名)
   # chown jake:jake -R myblog
   # cd myblog
   # hexo init
   ```

2. 用hexo -s 命令启动该博客，接着用浏览器输入localhost:4000 访问，检查是否成功
   ```bash
   # hexo s
   ```

   - 默认端口4000，你也可以自定义指定端口为5000
     ```bash
     # hexo s -p 5000
     ```

3. 另外介绍一个命令（后面要用到），用`hexo g`命令生成部署该博客（实质会生成一个public文件夹，这个文件夹下都是html静态页面）
   ```bash
   # hexo g
   ```

#### 5、win10系统访问虚拟机端口

由于我所有hexo部署都在虚拟机系统上，怎么通过win10主机访问我的博客页面呢

1. 开放虚拟机CentOS系统的4000端口
   ```bash
   # firewall-cmd --zone=public --add-port=4000/tcp --permanent
   ```

2. 重启防火墙
   ```bash
   # systemctl restart firewalld.service
   ```

3. 接下来你就可以通过win10上的浏览器输入虚拟机ip:4000访问你的博客了，当你看到如下图所示，那么恭喜你成功完成了第一步！

   ![img](11-29-09.jpg)

### 二、在第一步的基础上换一个华丽的主题（也就是matery），再用GitHub作为服务器来被外界访问

#### 1、下载matery主题

从github上下载一个matery主题(当前目录下)，然后把这个文件移动到`myblog/themes/`下

```bash
# git clone https://github.com/blinkfoxhexo-theme-matery.git
#/home/jake/myblog是我的博客根目录，需要根据自身情况予以修改
# mv hexo-theme-matery /home/jake/blog/themes/
```

#### 2、修改配置文件_config.yml

![img](11-29-10.jpg)

#### 3、切换到myblog文件下重新启动

```bash
# hexo s
```

![img](11-29-11.jpg)


#### 4、部署GitHub

接下来就部署GitHub了，前提你得有个GitHub账号，没有的话去注册一个（这里不提供教程，自己百度）

1. 登录你的GitHub，创建一个仓库

   ![img](11-29-12.jpg)

2. 按照规则为你的仓库起名（这个名字就是别人可以访问你博客的网址）
   ![img](11-29-13.jpg)
   ![img](11-29-14.jpg)

3. 打开`_config.yml`配置文件，配置你的仓库
   ```bash
   # vi _config.yml
   ```
   ![img](11-29-15.jpg)

4. 因为需要将项目推送到GitHub，所以需要安装一个插件
   ```bash
   # cnpm install --save hexo-deployer-git
   ```

5. 装好后直接用hexo g 生成博客文件，再用hexo d 推送项目到github上
   ```bash
   # hexo g
   # hexo d
   ```
   ![img](11-29-16.jpg)

6. 换用ssh公钥
   你会发现每次执行hexo d 推送到github上时需要输入账号和密码，这有点令人不耐烦，因此下面给大家展示一种用ssh公钥的方法去部署github

   - 在虚拟机CentOS系统上下载ssh key
     ```bash
     # ssh-keygen -t rsa
     #一路回车即可，然后查看/root下的文件夹
     # ls -al /root
     ```

   - 这时候你会发现在root下有一个隐藏文件.ssh，打开.ssh下的
     ```
     id_rsa.pub
     ```
     文件，复制此文件的全部内容,粘贴到下图所示位置

     打开github

     ![img](11-29-17.jpg)

     ![img](11-29-18.jpg)

     ![img](11-29-19.jpg)

   - 相应的也要修改
     ```
     _config.yml
     ```
     配置文件
     ![img](11-29-22.jpg)
     ![img](11-29-21.jpg)
     ![img](11-29-20.jpg)

#### 5、收获成功的喜悦

当你看到这里恭喜你已经成功完成了第一份属于自己的博客了!但你会发现，你通过github访问你的博客会很卡，简单说一下原因。github服务器在国外，所以访问速度很慢，这里提供一个简单的解决办法

1. 可以用国内的coding，类似github，去coding官网注册一个账号，记得要实名认证，然后仿照github的操作将ssh key内容粘贴到指定区域
   ![img](11-29-24.jpg)
   ![img](11-29-25.jpg)

2. 同样修改
   ```
   _config.yml
   ```

   配置文件
   ![img](11-29-23.jpg)

3. 用`hexo clean`清理一下 ==> `hexo g`生成 ==> `hexo d`部署推送博客

4. 接下来登录coding账号，查看仓库是存在项目，确定之后开始创建静态网站，步骤如下图所示
   ![img](11-29-26.jpg)
   ![img](11-29-27.jpg)
   ![img](11-29-28.jpg)

#### 6、温馨提示

最后温馨提示一下，matery主题虽然应用到hexo框架上了，但仍需要改动一些配置文件，根据每个人不同的喜好可以制定自己独特的博客，至于个性化设置这里就不介绍了，需要的小伙伴可以去参考以下链接，看看大佬们是如何设计优化matery主题和hexo博客框架的。

- 参考链接:
  [洪卫の博客:Hexo+Github博客搭建完全教程](https://sunhwee.com/posts/6e8839eb.html)
  [韦阳的博客:超详细Hexo+Github博客搭建小白教程](https://godweiyang.com/2018/04/13hexo-blog/)

> 如果实在不懂的小伙伴可以在下方留言，也可以参考一下这个大佬的视频[hexo博客搭建](https://www.bilibili.com/video/av44544186/)

### 三、将第二步中的github和coding替换为自己的云服务器，下面介绍如何部署好云服务器

#### 1. 创建git用户

当你做完前面两大步，这一步就相当的简单，原理都一样，首先在你的云服务机上，创建一个git用户,并指定密码

```bash
# useradd git
# passwd git
```

#### 2. 部署密钥到服务器上

切换到git用户，创建`.ssh`文件夹，以及在`.ssh`下创建`authorized_keys`文件,将ssh_key（也就是第二大步里面的那个密钥内容）粘贴到`authorized_keys`文件中

```bash
# su git
# 切换到git用户的家目录
# cd ~  
$ mkdir .ssh
$ vim ~/.ssh/autorized_keys # wq保存退出
# 修改一下.ssh 和 authorized_key 的权限，保证不被其他用户或用户组访问以及修改
$ chmod 600 ~/.ssh/authorized_key
$ chmod 700 ~/.ssh 
```

> 没有安装vim的 安装一下： `yum install -y vim`

#### 3. 安装nginx

```bash
# yum install -y nginx
# systemctl start nginx.service # 启动nginx服务
```

当你通过外网访问你的服务器ip可以看到nginx的欢迎页面就说明你安装成功了。这里说一下，有可能你显示的时centos欢迎页面，这也没问题。（我的就是）
打开`/etc/nginx/nginx.conf`配置文件（如果找不到，你也可以用`nginx -t`查看配置文件在哪）

![img](11-29-29.jpg)

接下来创建你的博客根目录(我创建的根目录是`/home/git/blog`)

```bash
$ mkdir ~/blog
```

修改nginx配置文件如下（注意以下两个地方）
第一个是权限问题
![img](11-29-31.jpg)
第二个是访问路径
![img](11-29-30.jpg)
配置好就重启一下nginx
```bash
# systemctl restart nginx.service
```

#### 4.创建git仓库

创建git仓库以及用hooks钩子同步到你的博客根目录
```bash
$ cd ~
$ git init --bare blog.git
$ ls -l blog.git
# 修改一下权限
# chown git:git -R blog.git
# 创建post-receive文件
$ vim blog.git/hooks/post-receive
```

添加以下内容：

> \#!/bin/sh
> git –work-tree=/home/git/blog –git-dir=/home/git/blog.git checkout -f
> `/home/git/blog`这是你刚刚创建的博客根目录
> 赋予其执行权限

```bash
$ chmod +x /home/git/blog.git/hooks/post-receive
```

接下来创建git-receive-pack和git-upload-pack软连接,以防执行hexo d 命令时报错找不到
```bash
# sudo ln -s /usr/local/git/bin/git-receive-pack  /usr/bin/git-recei
# sudo ln -s /usr/local/git/bin/git-upload-pack  /usr/bin/git-upload-pack
```

#### 5.修改配置文件

到本地的虚拟机系统上修改博客`_config.yml`配置文件
添加 `git@yourserver_ip:/home/git/blog.git`git服务器地址

![img](11-29-32.jpg)


> 特别注意：
> 如果你之前跟我一样配置三个git服务器（github、coding、自己的云服务器）,那么你就要删除一下本地系统中的`.ssh`文件中的`known_hosts`
> 只要你更改了`_config.yml`文件中git服务器地址，最好删除一下`known_hosts`
> 执行`hexo clean && hexo g && hexo d`

### 四、总结一下可能会碰到的错误

1. 经常会发生的错误：权限问题引起的。（这是个家常便饭，但你清楚了权限的重要性，那么你以后在linux系统上配置安装一些程序就很容易了）
   有时候你在安装依赖文件或者执行某些命令如`hexo d hexo clean hexo g`等等会报错，那是因为你使用的当前用户权限不够。包括你在向git服务器推送项目时，你的服务器那边git用户权限不足而导致操作不了某些文件。

   所以建议你把博客根目录下所有文件的使用者更改为你当前用户。当然你也可以用root用户去操作，但是经常切换用户很麻烦，或者使用sudo借用root权限也要输入密码。
   如：假设你的博客根目录路径为`/home/jake/myblog`
   那么使用以下命令更改权限
   ```bash
   $ sudo chown jake:jake -R /home/jake/myblog/*
   ```

2. 访问网页出现404错误，这种很好解决，一是你的nginx路径配错了，二是访问端口未开放，ip配置不对。

3. `hexo d`推送项目到git服务器时验证失败，首先确保你把本地的ssh_key密钥内容复制到了你的git服务器上了，然后删除你本地的`.ssh`文件夹下的`known_hosts`文件，重新`hexo d`,还有一种可能，你没有装推送必要的依赖插件`hexo-deployer-git`

### 五、讨论以及心得

有人可能会问我为什么不直接用windows作为本地进行操作，而要大费周章地去搞个虚拟机系统操作。

或许你会觉得Windows上操作会更容易，当然有些小伙伴可能想用windows搭建hexo博客，这里我就不介绍了。

其实用windows去搭建hexo博客的话我个人感觉有些别扭，因为你在windows操作的话在安装完git之后也是用git bash来部署安装hexo博客的，等价于用git bash 来营造一个Linux系统终端；

显得有点多此一举，况且多用用Linux系统对某些小伙伴以后的学习是有帮助的。

比如：虚拟机系统如何查看端口状态以及端口的开放和关闭，如何开启和关闭防火墙、虚拟机网速问题、git服务器的安装和使用、github、coding版本项目管理工具的使用、初步认识nginx负载均衡等等，这些都是我在搭建hexo中需要了解的知识。另外最重要的是我又对Linux系统有了进一步的了解

### 六、参考链接

1. [洪卫の博客:Hexo+Github博客搭建完全教程](https://sunhwee.com/posts/6e8839eb.html)
2. [韦阳的博客:超详细Hexo+Github博客搭建小白教程](https://godweiyang.com/2018/04/13hexo-blog/)
3. [Hexo 博客部署到腾讯云服务器全流程](https://blog.csdn.net/StaunchKai/article/details/82878928)
4. [centos7开放、关闭及查看端口](https://blog.csdn.net/qq_34996727/article/details/81065961)
5. [廖雪峰的Git教程](https://www.liaoxuefeng.com/wiki/896043488029600)

[文章来源](http://www.nstop.cn/)