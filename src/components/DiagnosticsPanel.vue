<template>
  <div class="diagnostics">
    <button class="diagnostics-toggle" type="button" @click="open = true">
      诊断
      <span v-if="errorCount" class="diagnostics-badge">{{ errorCount }}</span>
    </button>

    <div v-if="open" class="diagnostics-mask" @click.self="open = false">
      <section class="diagnostics-dialog">
        <header class="diagnostics-header">
          <h3>浏览器诊断</h3>
          <button class="diagnostics-close" type="button" @click="open = false">×</button>
        </header>

        <div class="diagnostics-body">
          <section class="diagnostics-section">
            <div class="diagnostics-row">
              <strong>硬件加速</strong>
              <button type="button" @click="detectHardware">重新检测</button>
            </div>
            <p>{{ hardwareStatus }}</p>
            <p class="diagnostics-tip">
              网页不能直接开启浏览器硬件加速，只能检测能力。请在浏览器设置中开启“使用图形加速/硬件加速”后重启浏览器。
            </p>
          </section>

          <section class="diagnostics-section">
            <div class="diagnostics-row">
              <strong>控制台错误</strong>
              <button type="button" @click="clearLogs">清空</button>
            </div>
            <div class="diagnostics-log">
              <p v-if="logs.length === 0" class="diagnostics-empty">暂无错误</p>
              <article v-for="log in logs" :key="log.id" class="diagnostics-log-item" :class="log.level">
                <div>
                  <span>{{ log.time }}</span>
                  <strong>{{ log.level }}</strong>
                </div>
                <pre>{{ log.message }}</pre>
              </article>
            </div>
          </section>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
let logId = 0;

function stringifyArg(arg) {
  if (arg instanceof Error) {
    return arg.stack || arg.message;
  }
  if (typeof arg === 'string') {
    return arg;
  }
  try {
    return JSON.stringify(arg, null, 2);
  } catch (error) {
    return String(arg);
  }
}

export default {
  name: 'DiagnosticsPanel',
  data() {
    return {
      open: false,
      logs: [],
      hardwareStatus: '尚未检测'
    };
  },
  computed: {
    errorCount() {
      return this.logs.filter(log => log.level === 'error').length;
    }
  },
  mounted() {
    this.installConsoleCapture();
    this.detectHardware();
  },
  methods: {
    addLog(level, args) {
      const message = Array.from(args).map(stringifyArg).join(' ');
      this.logs.unshift({
        id: ++logId,
        level,
        message,
        time: new Date().toLocaleTimeString()
      });
      this.logs = this.logs.slice(0, 100);
    },
    installConsoleCapture() {
      if (!window.__diagnosticsConsole) {
        const listeners = [];
        const original = {
          error: console.error.bind(console),
          warn: console.warn.bind(console)
        };

        window.__diagnosticsConsole = {
          listeners,
          original
        };

        console.error = (...args) => {
          original.error(...args);
          listeners.forEach(listener => listener('error', args));
        };
        console.warn = (...args) => {
          original.warn(...args);
          listeners.forEach(listener => listener('warn', args));
        };
        window.addEventListener('error', event => {
          listeners.forEach(listener => listener('error', [event.message, event.filename, event.lineno]));
        });
        window.addEventListener('unhandledrejection', event => {
          listeners.forEach(listener => listener('error', [event.reason || 'Unhandled promise rejection']));
        });
      }

      window.__diagnosticsConsole.listeners.push(this.addLog);
    },
    detectHardware() {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

      if (!gl) {
        this.hardwareStatus = 'WebGL 不可用。浏览器可能关闭了硬件加速，或显卡/驱动不支持。';
        return;
      }

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      this.hardwareStatus = `WebGL 可用。Vendor: ${vendor || 'unknown'}；Renderer: ${renderer || 'unknown'}`;
    },
    clearLogs() {
      this.logs = [];
    }
  }
};
</script>

<style scoped>
.diagnostics-toggle {
  position: fixed;
  right: 18px;
  top: 18px;
  z-index: 99999;
  min-width: 64px;
  height: 36px;
  color: #fff;
  cursor: pointer;
  background: #1f6feb;
  border: 0;
  border-radius: 4px;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.25);
}

.diagnostics-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  margin-left: 6px;
  font-size: 12px;
  background: #d1242f;
  border-radius: 9px;
}

.diagnostics-mask {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.45);
}

.diagnostics-dialog {
  width: min(760px, 100%);
  max-height: min(720px, 90vh);
  overflow: hidden;
  text-align: left;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
}

.diagnostics-header,
.diagnostics-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.diagnostics-header {
  padding: 14px 16px;
  border-bottom: 1px solid #d8dee4;
}

.diagnostics-header h3 {
  margin: 0;
  font-size: 16px;
}

.diagnostics-close {
  width: 30px;
  height: 30px;
  font-size: 22px;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.diagnostics-body {
  max-height: calc(90vh - 62px);
  padding: 16px;
  overflow: auto;
}

.diagnostics-section + .diagnostics-section {
  margin-top: 16px;
}

.diagnostics-section p {
  margin: 8px 0 0;
}

.diagnostics-tip {
  color: #57606a;
}

.diagnostics-row button {
  padding: 6px 10px;
  cursor: pointer;
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 4px;
}

.diagnostics-log {
  height: 360px;
  margin-top: 10px;
  overflow: auto;
  background: #0d1117;
  border-radius: 4px;
}

.diagnostics-empty {
  padding: 14px;
  color: #8b949e;
}

.diagnostics-log-item {
  padding: 10px 12px;
  color: #c9d1d9;
  border-bottom: 1px solid #30363d;
}

.diagnostics-log-item.warn strong {
  color: #d29922;
}

.diagnostics-log-item.error strong {
  color: #ff7b72;
}

.diagnostics-log-item div {
  display: flex;
  gap: 10px;
  margin-bottom: 6px;
  font-size: 12px;
  color: #8b949e;
}

.diagnostics-log-item pre {
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
