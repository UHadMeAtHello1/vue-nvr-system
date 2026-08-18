<template>
  <div id="app">
    <header class="app-header">
      <div class="logo-title">
        <span class="live-dot"></span>
        <h1>EasyNVR 智能视频监控系统</h1>
      </div>
      <div class="header-status">
        <span class="status-tag">🟢 系统就绪</span>
        <span class="status-time">{{ currentTime }}</span>
      </div>
    </header>
    <main class="app-main">
      <router-view></router-view>
    </main>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      currentTime: '',
      timer: null
    }
  },
  mounted() {
    this.updateTime()
    this.timer = setInterval(this.updateTime, 1000)
  },
  beforeDestroy() {
    if (this.timer) clearInterval(this.timer)
  },
  methods: {
    updateTime() {
      const now = new Date()
      this.currentTime = now.toLocaleString('zh-CN', {
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }
  }
}
</script>

<style>
:root {
  --primaryColor: #1890ff;
  --themeColor: #1991c2;
  --bgColor: #0b132b;
  --bgColor2: #1c2541;
  --bgColor4: #3a506b;
  --inputBg: #1c2541;
  --inputBorder: #3a506b;
  --btnBgColor: #1f4068;
  --btnHoverBgColor: #162447;
  --btnBgColor2: #1991c2;
  --formBgBorder: rgba(255, 255, 255, 0.12);
  --boxShadow: rgba(0, 0, 0, 0.4);
  --textColor: #ffffff;
  --textColorSecondary: #a0aec0;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body, html {
  width: 100%;
  height: 100%;
  background-color: var(--bgColor);
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  overflow: hidden;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: var(--bgColor);
}

.app-header {
  height: 56px;
  background: linear-gradient(180deg, #1c2541 0%, #0b132b 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid var(--formBgBorder);
  flex-shrink: 0;
}

.logo-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.live-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #52c41a;
  box-shadow: 0 0 8px #52c41a;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

.logo-title h1 {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 1px;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
  color: var(--textColorSecondary);
}

.status-tag {
  background: rgba(82, 196, 26, 0.15);
  border: 1px solid rgba(82, 196, 26, 0.4);
  color: #73d13d;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
}

.app-main {
  flex: 1;
  overflow: hidden;
  position: relative;
}
</style>
