---
title: Go 实战：用 WebAuthn + PASETO 给后台做一套无密码登录
date: 2026-06-18 22:02:20
categories:
  - Go
tags:
  - Go
  - Gin
  - WebAuthn
  - PASETO
  - 认证
description: 用 go-webauthn 和 PASETO 构建认证网关的记录，包括 challenge 管理、稳定的用户 ID、RP ID 配置等问题。
---

管理后台使用密码登录时，需要处理密码复用、哈希存储、拖库和钓鱼等问题。Passkey 出现之后，我决定把密码从系统中移除，于是写了 fifu-gateway：前面接管理后台，后面代理业务服务，认证统一在网关完成。

<!-- more -->

## 架构与信任边界

架构比较直接：`cat-admin` 运行在 5200，网关在 5000，业务服务 `cat-dataserver` 在 5100。网关处理 `/webauthn/*` 的注册和登录、`/admin/users` 的管理接口，再把 `/api/*` 反向代理到后端。业务服务不做认证，只信任网关注入的 `X-User-ID`、`X-Username` 和 `X-User-Role` 头。

这种模式成立的前提是业务服务不能直接暴露给公网。如果后端端口可以从外部访问，攻击者可以绕过网关直接伪造这些头，整套认证就没有意义。

## challenge 的生命周期

WebAuthn 的注册和登录都分为两步：start 接口返回 challenge 和选项，浏览器调用 `navigator.credentials.create` 或 `get`，finish 接口验证返回的结果。challenge 必须由服务端生成、一次性使用，并在短时间内有效。网关把它存放在进程内的 map 中，以用户名为键，有效期 10 分钟，另有一个 goroutine 每 5 分钟清理过期会话。

使用进程内存储是因为当时只部署单实例，希望先把流程跑通。这样做在本地没有问题，但如果扩容到多个实例，start 和 finish 落到不同实例时就找不到 challenge。

## 稳定的用户 ID

注册流程里遇到的第一个问题是用户 ID。注册发生在写入数据库之前，用户对象的 ID 为 0；登录时用户已经有数据库 ID。如果 `WebAuthnID()` 直接返回 ID，注册和登录会得到不同的值，凭证无法对应。浏览器只返回一个笼统的错误，服务端日志里没有更多信息。

最后的做法是用用户名的 SHA-256 作为稳定的 WebAuthn ID。无论用户是否已入库、ID 是多少，两边计算出的值都一致。代价是用户名不能修改，同一个用户名在不同环境中也会得到相同的 ID。对单实例的管理后台来说，这个取舍可以接受。

## JSON 转换

第二个问题是 JSON 结构。`go-webauthn` 返回 Go 结构体，前端使用的是 SimpleWebAuthn 风格的 JSON。challenge 和 `user.id` 需要 base64url 编码，`pubKeyCredParams`、`excludeCredentials`、`authenticatorSelection` 需要逐项转换。这部分代码比较繁琐，但只有转换正确，前端才能调用浏览器的 WebAuthn 接口。

## 登录验证与 PASETO

登录时，`ValidateLogin` 会检查 challenge、RP ID、origin、签名和签名计数器。计数器用于防克隆认证器：如果新断言的计数器没有增加，可能说明同一把私钥被复制到了其他设备。验证通过后更新用户记录，再签发 PASETO。

选择 PASETO 而不是 JWT，是因为 JWT 的 `alg` 头由令牌自身声明，攻击者可以将其改为 `none` 或 `HS256` 来影响验证逻辑。PASETO 把版本和用途写在令牌前缀中，不存在算法协商。项目使用 `v2.public`，Ed25519 签名，公钥验证、私钥签发。

密钥对在网关启动时生成。服务重启后，之前签发的令牌全部失效；如果部署多个实例，每个实例的密钥不同，用户在 A 实例登录、请求落到 B 实例时会被拒绝。对单实例后台来说，重启后强制重新登录可以接受，但这是实现带来的结果，而不是刻意的设计。

## 中间件与反向代理

认证中间件解析 Bearer token，把 payload 放进 Gin 上下文，并将三个身份头写入下游请求。角色中间件检查 `admin` 角色。反向代理使用 `httputil.NewSingleHostReverseProxy`，在 `Director` 中去掉 `/api` 前缀。当前所有 `/api` 路由都要求管理员身份。

## 配置与边界

配置里最容易出错的是 RP ID 和 origin。WebAuthn 的 RP ID 必须是注册域名，例如 `fifu.fun`，不能带协议和路径；origin 才是完整的 `https://fifu.fun`。项目最初用同一个环境变量同时充当两者，只要变量包含 `https://`，配置就不合法。浏览器只返回 `SecurityError`，服务端没有日志。把两者拆开后，配置才稳定下来。环境变量名中的 `PDisplayName` 拼写也造成过一次部署问题。

另外两个细节是在写完之后才注意到的。角色权限不足时最初返回 401，前端会据此跳转到登录页，语义上更合适的状态码是 403。业务服务完全信任网关注入的身份头，这一点对部署方式提出了明确要求。

这个网关的代码量不算大，但涉及 challenge 生命周期、RP ID 与 origin 匹配、用户 ID 稳定性和签名计数器等多个细节，任何一处出错都表现为浏览器端失败。PASETO 的部分相对简单，也更容易确认行为。项目目前作为个人后台的认证层使用。
