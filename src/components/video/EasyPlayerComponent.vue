<template>
  <div class="easy-player-wrapper">
    <div :key="playerContainerId" :id="playerContainerId" class="player-container"></div>
    <div v-if="status !== 'playing'" class="player-status">
      <span v-if="status === 'loading'">🔄 加载播放器...</span>
      <span v-if="status === 'initializing'">⚙️ 正在初始化...</span>
      <span v-if="status === 'error'" class="error">
        ❌ {{ errorMsg }}
        <button @click="retryPlayer">重试</button>
      </span>
    </div>
  </div>
</template>

<script>
/* global EasyPlayerPro */
export default {
  name: 'EasyPlayerComponent',
  props: {
    videoUrl: { type: String, required: true },
    isLive: { type: Boolean, default: true },
    options: { type: Object, default: () => ({}) }
  },
  data() {
    return {
      playerContainerId: `easyplayer_${Math.random().toString(36).substr(2, 9)}`,
      playerInstance: null,
      status: 'loading',
      errorMsg: '',
      reconnectAttempts: 0,
      maxReconnectAttempts: 3,
      reconnectTimer: null,
    };
  },
  watch: {
    videoUrl: {
      handler(newUrl, oldUrl) {
        if (newUrl && newUrl !== oldUrl) {
          if (this.playerInstance) {
            this.load(newUrl);
          } else {
            this.$nextTick(() => this.initPlayer());
          }
        } else if (!newUrl && this.playerInstance) {
          this.destroyPlayer();
        }
      },
      immediate: false
    }
  },
  mounted() {
    if (this.videoUrl) {
      this.initPlayer();
    }
  },
  beforeDestroy() {
    this.destroyPlayer();
    this.cleanupResources();
  },
  methods: {
    // 清理资源
    cleanupResources() {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    },

    initPlayer() {
      this.status = 'initializing';
      this.$nextTick(() => {
        try {
          const container = document.getElementById(this.playerContainerId);
          if (!container) {
            throw new Error('播放器容器未找到');
          }

          const config = {
            isLive: this.isLive,
            MSE: true,
            WASM: false,
            gpuDecoder: false,
            webGPU: false,
            bufferTime: 1,
            hasAudio: true,
            debug: false,
            ...this.options,

            useMSE: true,
            useWasm: false,
            useSIMD: false,
            autoWasm: true,
            decoderErrorAutoWasm: true,
            hardDecodingNotSupportAutoWasm: true,
            wasmDecodeErrorReplay: true,
            simdDecodeErrorReplay: true,
            mseDecodeErrorReplay: true,
            useVideoRender: true,
            useCanvasRender: false,
            mseUseCanvasRender: false,

            // 播放器内置超时自动重连（替代前端周期性强刷）
            loadingTimeout: 10,
            loadingTimeoutRetryEnd: 3,
            delayTimeout: 30,
            delayTimeoutRetryEnd: 3,
            timeout: 10,
          };

          this.playerInstance = new EasyPlayerPro(container, config);

          // 精简的事件监听
          this.playerInstance.on('fullscreen', (flag) => {
            this.$emit('fullscreen', flag);
          });

          this.playerInstance.on('play', () => {
            this.status = 'playing';
            this.reconnectAttempts = 0;
            this.$emit('play');
          });

          this.playerInstance.on('pause', () => {
            this.$emit('pause');
          });

          this.playerInstance.on('liveEnd', () => {
            this.$emit('ended');
          });

          // 核心优化：智能错误处理
          this.playerInstance.on('error', (err) => {
            console.error('播放器错误:', err);
            this.handlePlayerError(err);
          });

          this.playerInstance.on('loading', (loading) => {
            this.status = loading ? 'initializing' : this.status;
          });

          if (this.videoUrl) {
            this.load(this.videoUrl);
          }

        } catch (error) {
          console.error('初始化 EasyPlayerPro 失败:', error);
          this.status = 'error';
          this.errorMsg = `播放器初始化失败: ${error.message}`;
          this.$emit('error', error);
        }
      });
    },

    // 核心优化：智能错误处理
    handlePlayerError(error) {
      const errorText = error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error || '');

      const isDecoderFallbackError = [
        'mediaSourceAppendBufferError',
        'mseSourceBufferError',
        'mediaSourceDecoderConfigurationError',
        'MEDIA_ERR_DECODE',
        'REMOTE_DECODER_CRASHED'
      ].some(keyword => errorText.includes(keyword));

      if (isDecoderFallbackError) {
        console.warn('MSE 解码失败，等待 EasyPlayerPro 自动回退到 WASM:', errorText);
        this.status = 'initializing';
        return;
      }

      this.status = 'error';
      this.errorMsg = `播放错误: ${error || '未知错误'}`;
      this.$emit('error', error);

      if (this.playerInstance) {
        try {
          this.playerInstance.pause();
        } catch (e) {
          console.warn('停止异常播放器失败:', e);
        }
      }

      // 网络相关错误才重连
      const isNetworkError = error === "fetchError" ||
                            error === "websocketError" ||
                            error === "timeout" ||
                            (typeof error === 'string' && error.includes('network'));

      if (isNetworkError && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`网络错误，尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
          this.reinitializePlayer();
        }, 2000 * this.reconnectAttempts); // 递增延迟
      }
    },

    async reinitializePlayer() {
      this.destroyPlayer();
      this.playerContainerId = `easyplayer_${Math.random().toString(36).substr(2, 9)}`;
      await this.$nextTick();
      this.initPlayer();
    },

    retryPlayer() {
      this.reconnectAttempts = 0;
      this.reinitializePlayer();
    },

    clearReconnectTimer() {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    },

    load(url) {
      if (this.playerInstance && url) {
        this.status = 'initializing';
        this.playerInstance.play(url).then(() => {
          this.status = 'playing';
          this.reconnectAttempts = 0;
        }).catch((e) => {
          console.error('视频加载失败:', e);
          this.handlePlayerError(e);
        });
      }
    },

    destroyPlayer() {
      this.clearReconnectTimer();

      if (this.playerInstance) {
        try {
          this.playerInstance.pause();
          this.playerInstance.destroy();
        } catch (e) {
          console.warn('销毁播放器时出错:', e);
        }
        this.playerInstance = null;
      }

      this.status = 'loading';
      this.errorMsg = '';
    },

    // 暴露给父组件的方法
    play() {
      if (this.playerInstance && this.videoUrl) {
        this.load(this.videoUrl);
      }
    },

    pause() {
      if (this.playerInstance?.pause) {
        this.playerInstance.pause();
      }
    },

    fullscreen() {
      if (this.playerInstance?.fullscreen) {
        this.playerInstance.fullscreen();
      }
    },

    screenshot() {
      if (this.playerInstance?.screenshot) {
        this.playerInstance.screenshot();
      }
    },

    mute() {
      if (this.playerInstance?.mute) {
        this.playerInstance.mute();
      }
    },

    cancelMute() {
      if (this.playerInstance?.cancelMute) {
        this.playerInstance.cancelMute();
      }
    }
  }
};
</script>

<style scoped>
.easy-player-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #000;
  min-height: 300px;
}

.player-container {
  width: 100%;
  height: 100%;
}
.player-container :deep(video) {
  object-fit: fill !important;
}
.player-status {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  text-align: center;
  z-index: 5;
}

.player-status .error {
  color: #ff6b6b;
}

.player-status button {
  margin-left: 10px;
  padding: 4px 12px;
  background-color: #409eff;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}
</style>
