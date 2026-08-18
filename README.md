# EasyNVR 智能视频监控与云台调度系统 (EasyNVR Surveillance System)

[![Vue](https://img.shields.io/badge/Vue-2.6.14-brightgreen.svg)](https://vuejs.org/)
[![EasyNVR](https://img.shields.io/badge/Backend-EasyNVR-1991c2.svg)](https://www.tsingsee.com/product/easynvr)
[![EasyPlayer.js](https://img.shields.io/badge/Player-EasyPlayerPro_Wasm-blue.svg)](https://www.tsingsee.com/)
[![License](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
[![Protocols](https://img.shields.io/badge/Protocols-HTTP--FLV%20%7C%20WS--FLV%20%7C%20HLS%20%7C%20RTP-purple.svg)]()

本系统是**基于 Vue 2 + EasyPlayer.js (WebAssembly / WebGPU) 构建、深度搭配 EasyNVR 流媒体管理平台实现的高性能现代化多通道网络视频监控与云台调度系统**。

前端通过 RESTful 接口与 **EasyNVR** 智能视频边缘网关协同工作，支持**全通道动态接入渲染**、**低延迟实时视频流播放**、**八方向 PTZ 云台控制与变焦**、**预置位调度**、**历史录像查询与切片回放**以及**基于 Web Audio API 与 WebSocket 的双向语音对讲**。

---

## 📸 功能特性 (Features)

- **⚡ 搭配 EasyNVR 赋能的低延迟流媒体播放**
  - 后端由 EasyNVR 对接 RTSP / ONVIF / GB28181 摄像头，分发出 HTTP-FLV、WS-FLV、HLS (`.m3u8`) 视频流。
  - 前端基于 WebAssembly + MSE / WebGPU 硬件加速解码，实现毫秒级超低延迟（< 1s）与自适应断流重连。
- **📡 动态通道探测与自适应渲染**
  - 不再硬编码摄像头名称与数量，自动获取 EasyNVR 中接入的所有在线摄像头通道并生成横向滚动标签栏。
  - 每个通道具备实时状态徽章（`LIVE` 在线 / `ERROR` 异常 / `STANDBY` 待机）。
- **🎮 八方向 PTZ 云台与变焦控制**
  - 支持上、下、左、右及四个对角线方向的精细化 PTZ 步进与连续控制。
  - 支持云台焦距放大 (`ZOOM_IN`) / 缩小 (`ZOOM_OUT`) 与对焦调节 (`FOCUS_IN` / `FOCUS_OUT`)。
  - 支持一键转至预置位（Preset Position）以及软件级云台方向翻转（针对倒装摄像头场景）。
- **🎙️ Web 端双向实时语音对讲 (Two-way Audio Intercom)**
  - 基于 Web Audio API (AudioWorklet 引擎) 采集麦克风音频。
  - 内置 G.711a 音频编码器与 RTP 封包传输，通过 WebSocket 实时推送到 EasyNVR 对讲服务转发至摄像头。
  - 具备回声消除 (AEC)、噪声抑制 (ANS) 与自动增益控制 (AGC)。
- **⏪ 历史录像检索与切片点播**
  - 调用 EasyNVR 录像接口按日期选择检索云端/本地存储的历史录像片段。
  - 时间戳解析与录像列表快速点播，支持无缝退出回放切换回实时直播。
- **🚨 完善的异常捕获与可视化诊断**
  - 当接口请求失败或推流异常时，视窗中央直接弹出深色科技感错误卡片。
  - 支持一键重试拉流、远程重启 EasyNVR 摄像头服务、重新扫描通道等运维操作。

---

## 🏗️ 系统架构与数据流 (Architecture)

```text
+--------------------------------------------------------------------------------+
|                               浏览器前端 (Vue 2 Web Client)                      |
|                                                                                |
|  +--------------------+   +---------------------+   +-----------------------+  |
|  | EasyPlayerPro.wasm |   | PTZ 云台控制组件     |   | Web Audio 语音采集    |  |
|  | (HTTP-FLV/WS-FLV)  |   | (8-Direction & Zoom)|   | (G.711a / RTP / AEC)  |  |
|  +--------------------+   +---------------------+   +-----------------------+  |
+------------▲-------------------------▲--------------------------▲--------------+
             │ 视频流拉流 (FLV)         │ HTTP REST 控制指令        │ WebSocket 音频推流
             │                         │                         │
+------------▼-------------------------▼--------------------------▼--------------+
|                         EasyNVR 边缘流媒体智能网关服务端                          |
|                     (默认端口: HTTP 20000/10800, HTTPS 4433)                   |
+--------------------------------------------------------------------------------+
             │                         │                         │
             │ RTSP / RTMP             │ ONVIF / PTZ 协议        │ G.711a / G.711u
+------------▼-------------------------▼--------------------------▼--------------+
|                    前端 IP 摄像机 / NVR 硬盘录像机 (IPC / NVR)                  |
+--------------------------------------------------------------------------------+
```

---

## 📖 EasyNVR 搭配部署简短教程 (EasyNVR Integration Guide)

本 Demo 依赖 EasyNVR 提供的流媒体服务与 RESTful API，只需以下几步即可完成协同配置：

### 第一步：在 EasyNVR 中接入摄像头
1. 启动并登录 EasyNVR 管理后台（默认端口 `http://<EasyNVR_IP>:10800` 或 `20000`，默认账号密码 `admin / admin`）。
2. 进入 **【通道配置】** 或 **【设备管理】**：
   - 点击 **添加通道**，输入摄像头的 RTSP 流地址（例如：`rtsp://admin:password@192.168.1.64:554/h264/ch1/main/av_stream`）或通过 ONVIF 自动搜索接入。
   - 开启通道的 **按需直播** 或 **全天直播**，确认通道状态显示为 **“在线”** 且能正常预览。
   - 若摄像头支持 PTZ 云台，请勾选 **启用云台控制 (ONVIF)** 并填写对应 ONVIF 端口和凭据。

### 第二步：确认 EasyNVR 接口与跨域设置
- EasyNVR 默认提供标准的 HTTP REST API（如 `/channels`、`/channels/{id}/play`、`/devices/{id}/ptz`、`/records` 等）。
- 确认 EasyNVR 服务已开启跨域访问支持（CORS），或通过前端开发服务器的反向代理进行接口转发。

### 第三步：配置前端项目的 EasyNVR 地址
打开项目中的 `src/api/monitorSystem.js`，将 EasyNVR 运行的 IP 和端口填入配置：

```javascript
// src/api/monitorSystem.js
function getBaseURL() {
  // 默认读取当前访问域名，或指定 EasyNVR 服务器 IP
  const systemIp = location.hostname || '192.168.200.41';
  
  if (location.protocol === 'https:') {
    return `${location.protocol}//${systemIp}:4433`;
  } else {
    return `${location.protocol}//${systemIp}:20000`; // 若 EasyNVR 使用 10800 端口，可在此修改
  }
}
```

并在 `vue.config.js` 中按需配置本地反向代理（解决本地调试时的跨域问题）：

```javascript
// vue.config.js
module.exports = {
  devServer: {
    port: 8080,
    proxy: {
      '/channels': { target: 'http://192.168.200.41:20000', changeOrigin: true },
      '/devices':  { target: 'http://192.168.200.41:20000', changeOrigin: true },
      '/records':  { target: 'http://192.168.200.41:20000', changeOrigin: true },
      '/proxy':    { target: 'http://192.168.200.41:20000', changeOrigin: true }
    }
  }
}
```

### 第四步：启动前端项目
```bash
npm run serve
```
启动后前端会自动向 EasyNVR 请求 `/channels` 获取全部接入通道并自动开始拉流直播。

---

## 📁 目录结构 (Directory Structure)

```text
vue-nvr-surveillance-system/
├── public/
│   ├── codebase/              # 专用解码插件库 (AES/RSA/jsPlugin)
│   ├── demo.css               # 基础 UI 主题样式
│   ├── EasyPlayer-pro.js      # EasyPlayerPro 核心 WebAssembly 播放器脚本
│   ├── EasyPlayer-pro.wasm    # 视频解码 WASM 核心二进制
│   ├── EasyPlayer-snap.wasm   # 视频快照 WASM 模块
│   ├── easyplayer-pro-talk.js # 语音对讲 Web Audio / RTP 封装库
│   ├── favicon.ico
│   └── index.html             # HTML 模版与静态资源引入
├── src/
│   ├── api/
│   │   └── monitorSystem.js   # EasyNVR 接口封装 (通道获取/推流/PTZ控制/录像回放/对讲/服务重启)
│   ├── assets/
│   │   ├── css/
│   │   │   └── ptzCtrl.less   # PTZ 控制面板与回放样式
│   │   └── imgs/monitor/      # 云台方向、变焦、播放控制等图标资源
│   ├── components/
│   │   ├── video/
│   │   │   └── EasyPlayerComponent.vue  # EasyPlayer 封装组件 (WASM解码/自适应重连/错误处理)
│   │   ├── DiagnosticsPanel.vue         # 系统与流状态自检诊断面板
│   │   └── NVRdemo.vue                  # 监控主界面 (动态通道/实时直播/云台控制/录像回放/语音对讲)
│   ├── router/
│   │   └── index.js           # Vue Router 路由配置
│   ├── utils/
│   │   ├── cameraConfigManager.js # 摄像头通道动态探测与多级缓存管理器
│   │   └── Talk.js            # 语音对讲控制类 (AudioWorklet + WebSocket + G.711a)
│   ├── App.vue                # 根组件 (监控看板头部与导航)
│   └── main.js                # 入口文件
├── babel.config.js
├── package.json
├── vue.config.js              # Vue CLI 开发服务器与代理配置
└── README.md
```

---

## 🚀 快速上手 (Quick Start)

### 1. 环境准备 (Prerequisites)
- **Node.js**: >= 14.x (推荐 16.x 或 18.x)
- **包管理器**: npm 或 yarn
- **后端服务**: 已启动并接入摄像头的 [EasyNVR](https://www.tsingsee.com/product/easynvr) 平台

> ⚠️ **关于语音对讲的浏览器安全策略说明**：
> 现代浏览器出于安全考量，**仅在 HTTPS 环境或 `localhost` 下开放麦克风采集权限 (`navigator.mediaDevices.getUserMedia`)**。如需在生产环境中使用语音对讲功能，请配置 SSL 证书开启 HTTPS 访问。

### 2. 安装依赖 (Install)
```bash
npm install
# 或者使用 yarn
yarn install
```

### 3. 运行开发服务器 (Run Dev)
```bash
npm run serve
```
启动成功后，在浏览器中打开 `http://localhost:8080` 即可查看监控界面。

### 4. 项目构建与打包 (Build)
```bash
npm run build
```
打包输出位于 `dist/` 目录，可直接部署于 Nginx 或集成至各类生产网关中。

---

## 🔌 API 接口与 EasyNVR 对应规范

| 功能模块 | 请求方式 | 接口路由 | EasyNVR 作用描述 |
| :--- | :---: | :--- | :--- |
| **通道列表** | `GET` | `/channels` | 获取 EasyNVR 中所有已挂载的摄像头通道信息与在线状态 |
| **请求推流** | `POST` | `/channels/{channelId}/play` | 请求 EasyNVR 开启指定通道流并返回 HTTP-FLV / WS-FLV 播放地址 |
| **停止推流** | `DELETE` | `/channels/{channelId}/play` | 停止指定通道推流，释放 EasyNVR 与设备连接资源 |
| **云台开始** | `POST` | `/devices/{deviceId}/ptz/start` | 下发 PTZ 运动/变焦指令 (`TOP`, `BOTTOM`, `ZOOM_IN` 等) |
| **云台停止** | `POST` | `/devices/{deviceId}/ptz/stop` | 停止当前方向的 PTZ 运动 |
| **移动预置位**| `POST` | `/devices/{channelId}/ptz/preset` | 将云台转动至指定编号的预置位点 |
| **语音对讲** | `POST` | `/channels/{channelId}/talk` | 申请语音对讲会话，返回 WebSocket 对讲推流地址 |
| **录像初始化**| `GET` | `/records` | 检索指定起止时间范围内的录像索引及 SSRC 信息 |
| **录像点播** | `GET` | `/records/hls/index.m3u8` | 获取指定切片时间段的 HLS 录像回放流地址 |
| **服务重启** | `POST` | `/system/restart` | 远程重启 EasyNVR 摄像头/流媒体服务 |

---

## 🛠️ PTZ 指令速查 (PTZ Direction Map)

| 指令代码 | 方向/操作 | 指令代码 | 方向/操作 |
| :--- | :--- | :--- | :--- |
| `TOP` | 向上俯仰 | `BOTTOM` | 向下俯仰 |
| `LEFT` | 向左旋转 | `RIGHT` | 向右旋转 |
| `TOP_LEFT` | 左上移动 | `TOP_RIGHT` | 右上移动 |
| `BOTTOM_LEFT`| 左下移动 | `BOTTOM_RIGHT`| 右下移动 |
| `ZOOM_IN` | 镜头放大 (变倍+) | `ZOOM_OUT` | 镜头缩小 (变倍-) |
| `FOCUS_IN` | 焦点前移 (对焦+) | `FOCUS_OUT` | 焦点后移 (对焦-) |

---

## 📝 常见问题与排查 (Troubleshooting)

1. **视频播放提示“推流失败”或无法拉流？**
   - 检查 EasyNVR 后台该通道是否显示“在线”，且在 EasyNVR 原生管理后台中能否正常播放。
   - 检查 `src/api/monitorSystem.js` 中的 IP 与端口是否指向正确的 EasyNVR 服务地址。
2. **EasyPlayerPro 提示“播放器初始化失败”？**
   - 检查 `public/EasyPlayer-pro.wasm` 与 `public/EasyPlayer-pro.js` 文件是否正常加载（F12 网络面板确认无 404）。
3. **语音对讲无法启动或提示权限被拒绝？**
   - 浏览器要求采集音频必须在 `localhost` 或 `HTTPS` 安全上下文下执行。局域网 IP 访问需配置 SSL 证书开启 HTTPS。
4. **云台控制无反应？**
   - 在 EasyNVR 后台确认该通道已正确配置 ONVIF 协议和云台支持，且设备处于可控状态。

---

## 📄 开源协议 (License)

本项目基于 [MIT License](LICENSE) 协议开源。
