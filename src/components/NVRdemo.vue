<template>
  <div class="substance">
    <div class="MonitorSystem">
      <!-- 顶部动态摄像头通道切换栏 -->
      <div class="channel-bar-wrapper">
        <div class="channel-scroll-container">
          <ul class="inOrOut">
            <li
              v-for="camera in cameraList"
              :key="camera.cameraType"
              :class="{ activeLi: InOrOut === camera.cameraType }"
              @click="switchCamera(camera.cameraType)"
            >
              <span class="camera-icon">🎥</span>
              <span class="camera-title">{{ camera.channelName }}</span>
              <span v-if="videoUrlMap[camera.cameraType]" class="channel-badge live">LIVE</span>
              <span v-else-if="streamErrors[camera.cameraType]" class="channel-badge error">ERROR</span>
              <span v-else class="channel-badge idle">STANDBY</span>
            </li>
          </ul>
        </div>
        <div class="channel-actions">
          <button class="action-mini-btn" title="重新获取通道列表" @click="refreshCameraConfigs">
            🔄 刷新通道
          </button>
        </div>
      </div>

      <div class="flex-box">
        <!-- 左侧主监控/播放视窗 -->
        <div class="RealTimeMonitor" id="RealTimeMonitor">
          <!-- 视窗 HUD 浮层信息 -->
          <div class="player-hud">
            <div class="hud-left">
              <span class="hud-status-dot" :class="{ active: isCurrentCameraPlaying }"></span>
              <span class="hud-name">{{ currentCameraName }}</span>
              <span class="hud-channel-tag">{{ currentChannelId || '未连接通道' }}</span>
            </div>
            <div class="hud-right">
              <span v-if="activeControlTab === 'playback'" class="hud-mode-badge playback">录像回放模式</span>
              <span v-else class="hud-mode-badge live">实时直播</span>
            </div>
          </div>

          <!-- 实时监控视频流（单播放器实例动态驱动） -->
          <EasyPlayerComponent
            v-if="activeControlTab !== 'playback' && currentLiveVideoUrl"
            :key="'live_' + InOrOut + '_' + currentLiveVideoUrl"
            class="mainVideoPlay"
            ref="VideoPlayer"
            :videoUrl="currentLiveVideoUrl"
            :isLive="true"
            @error="handleVideoPlayerError"
            @play="handlePlayStart"
            @pause="handlePlayPause"
          />

          <!-- 回放视频流 -->
          <div v-if="activeControlTab === 'playback' && playbackVideoUrl" class="playbackVideoContainer">
            <EasyPlayerComponent
              :key="'playback_' + playbackVideoUrl"
              :videoUrl="playbackVideoUrl"
              :isLive="false"
              @error="handleVideoPlayerError"
            />
          </div>

          <!-- 回放未选择切片提示 -->
          <div v-else-if="activeControlTab === 'playback' && !playbackVideoUrl" class="playbackEmptyContainer">
            <div class="empty-tip-card">
              <div class="empty-icon">📅</div>
              <div class="empty-title">录像切片检索与回放</div>
              <div class="empty-sub">请在右侧选择回放日期，点击“查找回放”后在列表中选择时间切片播放</div>
              <button class="btn-action secondary" @click="exitPlaybackMode">◀ 返回实时直播</button>
            </div>
          </div>

          <!-- 推流异常 / 接口错误全局提示卡片 -->
          <div
            v-if="currentStreamError && !isCurrentCameraPlaying && activeControlTab !== 'playback'"
            class="stream-error-overlay"
          >
            <div class="stream-error-card">
              <div class="error-badge-icon">⚠️</div>
              <div class="stream-error-title">{{ currentCameraName }} 视频流连接异常</div>
              <div class="stream-error-message">
                <span class="err-label">错误详情：</span>
                <span class="err-desc">{{ currentStreamError }}</span>
              </div>
              <div class="stream-error-info">
                <span>设备ID: <code>{{ deviceId || '未检测到' }}</code></span>
                <span>通道ID: <code>{{ currentChannelId || '未检测到' }}</code></span>
              </div>
              <div class="stream-error-actions">
                <button class="btn-action primary" @click="retryCurrentStream">
                  🔄 重试连接视频流
                </button>
                <button class="btn-action restart" :disabled="isRestarting" @click="shutdownFun">
                  ⚡ {{ isRestarting ? '重启服务中...' : '远程重启摄像头服务' }}
                </button>
                <button class="btn-action secondary" @click="refreshCameraConfigs">
                  📡 刷新通道配置
                </button>
              </div>
            </div>
          </div>

          <!-- 视频窗口快捷控制悬浮栏 -->
          <div class="video-floating-controls">
            <button class="float-btn" title="手动重拉视频流" @click="manualRefreshStream">
              🔄
            </button>
            <button class="float-btn" title="全屏查看" @click="fullScreenChange">
              ⛶
            </button>
          </div>
        </div>

        <!-- 右侧功能面板（云台控制 / 录像回放） -->
        <div class="right-control">
          <!-- 标签页切换栏 -->
          <div class="rightBox">
            <ul class="controlMenuBox">
              <li :class="{ activeLi: activeControlTab === 'ptz' }" @click="switchControlTab('ptz')">
                🎮 云台控制
              </li>
              <li :class="{ activeLi: activeControlTab === 'playback' }" @click="switchControlTab('playback')">
                🎞️ 录像回放
              </li>
            </ul>
          </div>

          <!-- 云台控制面板 -->
          <div v-if="activeControlTab === 'ptz'" class="controlInner">
            <div class="ptz-panel-header">
              <span class="camera-tag">{{ currentCameraName }}</span>
              <span v-if="isPtzReversed" class="ptz-reverse-tag">云台已翻转</span>
            </div>

            <!-- 八方向云台控制器 -->
            <div class="ptz-controller-card">
              <div class="ptz-row">
                <button class="ptz-dir-btn" @mousedown="ptzControlFun('leftup')" @mouseup="ptzControlFun('stop')" title="左上">↖</button>
                <button class="ptz-dir-btn" @mousedown="ptzControlFun('up')" @mouseup="ptzControlFun('stop')" title="向上">▲</button>
                <button class="ptz-dir-btn" @mousedown="ptzControlFun('rightup')" @mouseup="ptzControlFun('stop')" title="右上">↗</button>
              </div>
              <div class="ptz-row">
                <button class="ptz-dir-btn" @mousedown="ptzControlFun('left')" @mouseup="ptzControlFun('stop')" title="向左">◀</button>
                <button class="ptz-dir-btn center-btn" @click="yuzhiPointFun" title="转到预置位">📍</button>
                <button class="ptz-dir-btn" @mousedown="ptzControlFun('right')" @mouseup="ptzControlFun('stop')" title="向右">▶</button>
              </div>
              <div class="ptz-row">
                <button class="ptz-dir-btn" @mousedown="ptzControlFun('leftdown')" @mouseup="ptzControlFun('stop')" title="左下">↙</button>
                <button class="ptz-dir-btn" @mousedown="ptzControlFun('down')" @mouseup="ptzControlFun('stop')" title="向下">▼</button>
                <button class="ptz-dir-btn" @mousedown="ptzControlFun('rightdown')" @mouseup="ptzControlFun('stop')" title="右下">↘</button>
              </div>
            </div>

            <!-- 焦距与特殊调节工具 -->
            <div class="ptz-action-tools">
              <div class="tool-row">
                <span class="tool-label">变倍:</span>
                <button class="btn-tool" @mousedown="ptzControlFun('ZOOM_OUT')" @mouseup="ptzControlFun('stop')">🔍 - 缩小</button>
                <button class="btn-tool" @mousedown="ptzControlFun('ZOOM_IN')" @mouseup="ptzControlFun('stop')">🔍 + 放大</button>
              </div>
              <div class="tool-row">
                <span class="tool-label">对焦:</span>
                <button class="btn-tool" @mousedown="ptzControlFun('FOCUS_OUT')" @mouseup="ptzControlFun('stop')">🎯 - 远焦</button>
                <button class="btn-tool" @mousedown="ptzControlFun('FOCUS_IN')" @mouseup="ptzControlFun('stop')">🎯 + 近焦</button>
              </div>
              <div class="tool-row">
                <button class="btn-tool full-width" :class="{ active: isPtzReversed }" @click="togglePtzReverse">
                  🔄 {{ isPtzReversed ? '关闭云台方向翻转' : '开启云台方向翻转' }}
                </button>
              </div>
            </div>

            <!-- 语音双向对讲区域 -->
            <div class="VoiceIntercom">
              <div class="intercom-title">🎙️ 语音双向对讲</div>
              <div class="intercom-btn-group">
                <button
                  class="btn-intercom start"
                  :class="{ 'btn-talking': isVoiceTalking }"
                  :disabled="isVoiceTalking"
                  @click="startVoiceTalk()"
                >
                  {{ isVoiceTalking ? '🎙️ 对讲中...' : '🎙️ 开始对讲' }}
                </button>
                <button
                  class="btn-intercom stop"
                  :disabled="!isVoiceTalking"
                  @click="stopVoiceTalk()"
                >
                  ⏹️ 停止对讲
                </button>
              </div>
              <div v-if="isVoiceTalking" class="talk-status">
                <span class="status-indicator"></span>
                <span class="status-text">对讲通道已接通 (G.711a {{ transport || 'RTP' }})</span>
              </div>
            </div>
          </div>

          <!-- 视频录像回放面板 -->
          <div v-if="activeControlTab === 'playback'" class="controlInner controlInner--playback">
            <div class="playbackChoose">
              <div class="playback-row">
                <label>选择日期:</label>
                <el-date-picker
                  v-model="selectedDate"
                  type="date"
                  placeholder="选择回放日期"
                  format="yyyy-MM-dd"
                  value-format="yyyy-MM-dd"
                  :picker-options="pickerOptions"
                  @change="onDateChange"
                />
              </div>

              <div class="playbackControls">
                <div class="playback-action-row">
                  <button class="btn-action primary" @click="loadPlaybackVideo" :disabled="!selectedDate || isSearchingPlayback">
                    {{ isSearchingPlayback ? '🔍 正在查找...' : '🔍 查找回放' }}
                  </button>
                  <button class="btn-action secondary" @click="exitPlaybackMode">
                    ◀ 返回直播
                  </button>
                </div>

                <div v-if="playbackUrls.length > 0" class="playback-url-list">
                  <div class="list-header">
                    <span>录像切片列表</span>
                    <span class="list-count">{{ playbackUrls.length }} 段</span>
                  </div>
                  <div class="url-list">
                    <div
                      v-for="(url, index) in playbackUrls"
                      :key="index"
                      :class="{ 'selected': url === selectedPlaybackUrl }"
                      @click="selectPlaybackUrl(url)"
                      class="url-item"
                    >
                      <span class="url-icon">🎬</span>
                      <span class="url-time">{{ extractTimeSegment(url) }}</span>
                    </div>
                  </div>
                </div>
                <div v-else-if="selectedDate && isPlaybackSearched" class="playback-empty-records">
                  ⚠️ 未检索到该日期的录像切片数据
                </div>

                <button
                  v-if="selectedPlaybackUrl"
                  class="btn-action play-btn"
                  @click="playSelectedPlayback"
                >
                  ▶ 播放选中切片
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import EasyPlayerComponent from "./video/EasyPlayerComponent.vue";
import {
  ptzControlStart,
  playStart,
  ptzControlStop,
  playStop,
  shutdown,
  getDevices,
  yuzhiPoint,
  startTalk,
  playBack,
  playBackInit
} from "@/api/monitorSystem";
import cameraConfigManager from "@/utils/cameraConfigManager";
import Talk from "@/utils/Talk";

export default {
  name: 'NVRdemo',
  components: { EasyPlayerComponent },
  data() {
    return {
      InOrOut: 1, // 当前选中的摄像头类型标识（1, 2, ...）
      cameraConfigs: [], // 动态摄像头配置列表
      videoUrlMap: {}, // 映射每个摄像头的当前播放地址：{ 1: 'url1', 2: 'url2' }
      streamErrors: {}, // 映射每个摄像头的推流错误信息：{ 1: '错误内容' }
      isRefreshingStream: false,
      isPlayStarting: false,
      isRestarting: false,

      // 录像回放相关数据
      activeControlTab: 'ptz', // 'ptz' 或 'playback'
      playbackVideoUrl: null,
      selectedDate: null,
      playbackUrls: [],
      selectedPlaybackUrl: null,
      isPlaybackSearched: false,
      isSearchingPlayback: false,
      pickerOptions: {
        disabledDate(time) {
          return time.getTime() > Date.now();
        }
      },

      // 云台相关数据
      isPtzReversed: false,
      lastDirection: null,

      // 语音对讲相关数据
      isVoiceTalking: false,
      talkInstance: null,
      talkUrl: null,
      transport: null,
      visibilityChangeHandler: null
    };
  },
  computed: {
    cameraList() {
      if (this.cameraConfigs && this.cameraConfigs.length > 0) {
        return this.cameraConfigs;
      }
      return [
        { cameraType: 1, channelName: '摄像头 1', channelId: '', deviceId: '' },
        { cameraType: 2, channelName: '摄像头 2', channelId: '', deviceId: '' },
        { cameraType: 3, channelName: '摄像头 3', channelId: '', deviceId: '' }
      ];
    },
    currentCameraConfig() {
      if (!this.cameraConfigs || this.cameraConfigs.length === 0) return null;
      return this.cameraConfigs.find(c => c.cameraType === this.InOrOut) || this.cameraConfigs[0];
    },
    currentCameraName() {
      return this.currentCameraConfig?.channelName || `摄像头 ${this.InOrOut}`;
    },
    currentChannelId() {
      return this.currentCameraConfig?.channelId || null;
    },
    deviceId() {
      return this.currentCameraConfig?.deviceId || null;
    },
    currentLiveVideoUrl() {
      return this.videoUrlMap[this.InOrOut] || null;
    },
    isCurrentCameraPlaying() {
      return !!this.currentLiveVideoUrl;
    },
    currentStreamError() {
      return this.streamErrors[this.InOrOut] || null;
    }
  },
  async created() {
    this.ensureFeedbackServices();
    await this.initCameraConfigs();
    this.setupVisibilityHandler();
  },
  methods: {
    ensureFeedbackServices() {
      const hasMessageApi = this.$message
        && ['success', 'error', 'warning', 'info'].every(type => typeof this.$message[type] === 'function');
      if (!hasMessageApi) {
        this.$message = {
          success: (msg) => console.log('[Success]', msg),
          error: (msg) => console.error('[Error]', msg),
          warning: (msg) => console.warn('[Warning]', msg),
          info: (msg) => console.log('[Info]', msg)
        };
      }
      if (!this.$loading) {
        this.$loading = (options) => {
          console.log('[Loading]', options?.text || '加载中...');
          return { close() {} };
        };
      }
    },
    wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },
    getSystemIp() {
      return location.hostname || '192.168.200.41';
    },
    getBaseURL() {
      const systemIp = this.getSystemIp();
      const port = location.protocol === 'https:' ? '4433' : '20000';
      return `${location.protocol}//${systemIp}:${port}`;
    },
    buildStreamUrl(address) {
      if (!address) return null;
      if (address.http_flv) {
        const path = address.http_flv;
        const { pathname, search } = /^https?:\/\//.test(path) ? new URL(path) : { pathname: path, search: '' };
        const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
        return `${this.getBaseURL()}${cleanPath}${search}`;
      }
      if (address.ws_flv) {
        const path = address.ws_flv;
        const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsPort = location.protocol === 'https:' ? '4433' : '20000';
        const { pathname, search } = /^wss?:\/\//.test(path) ? new URL(path) : { pathname: path, search: '' };
        const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
        return `${wsProtocol}//${this.getSystemIp()}:${wsPort}${cleanPath}${search}`;
      }
      return null;
    },

    // 初始化动态摄像头配置
    async initCameraConfigs() {
      try {
        const configs = await cameraConfigManager.initializeConfigs();
        this.cameraConfigs = configs || [];
        if (this.cameraConfigs.length > 0) {
          const firstType = this.cameraConfigs[0].cameraType;
          this.InOrOut = firstType;
          await this.$nextTick();
          this.playStartFun(firstType);
        }
      } catch (error) {
        console.error('初始化摄像头配置失败:', error);
        this.$message.error('加载摄像头配置异常：' + error.message);
      }
    },

    // 刷新摄像头配置
    async refreshCameraConfigs() {
      try {
        this.$message.info('正在重新扫描摄像头通道...');
        const configs = await cameraConfigManager.refreshConfigs();
        this.cameraConfigs = configs || [];
        this.$message.success(`已成功连接 ${this.cameraConfigs.length} 个摄像头通道`);
        if (this.cameraConfigs.length > 0) {
          const currentExists = this.cameraConfigs.some(c => c.cameraType === this.InOrOut);
          const targetType = currentExists ? this.InOrOut : this.cameraConfigs[0].cameraType;
          this.InOrOut = targetType;
          this.playStartFun(targetType);
        }
      } catch (error) {
        console.error('刷新摄像头配置失败:', error);
        this.$message.error('刷新通道配置失败：' + (error.message || '网络异常'));
      }
    },

    // 切换选中的摄像头
    async switchCamera(cameraType) {
      if (this.isRefreshingStream) {
        this.$message.info('正在切换中，请稍候...');
        return;
      }
      if (this.InOrOut === cameraType) {
        return;
      }

      if (this.activeControlTab === 'playback') {
        this.exitPlaybackMode();
      }

      this.isRefreshingStream = true;
      try {
        // 停止上一个摄像头的流
        const oldChannelId = this.currentChannelId;
        this.$set(this.videoUrlMap, this.InOrOut, null);
        if (oldChannelId) {
          try {
            await playStop(oldChannelId);
          } catch (e) {
            console.warn('停止旧视频流失败:', e);
          }
        }
        await this.wait(200);

        this.InOrOut = cameraType;
        await this.$nextTick();

        // 启动新摄像头的推流
        await this.playStartFun(cameraType);
      } catch (error) {
        console.error('切换摄像头异常:', error);
        this.$message.error('切换摄像头失败，请重试');
      } finally {
        this.isRefreshingStream = false;
      }
    },

    // 请求播放指定摄像头
    async playStartFun(cameraType) {
      if (this.isPlayStarting) return;
      this.isPlayStarting = true;

      const targetConfig = this.cameraConfigs.find(c => c.cameraType === cameraType);
      const channelId = targetConfig ? targetConfig.channelId : null;
      const cameraName = targetConfig ? targetConfig.channelName : `摄像头 ${cameraType}`;

      if (!channelId) {
        const errMsg = `未检索到 ${cameraName} 的有效通道 ID`;
        this.$set(this.streamErrors, cameraType, errMsg);
        this.$message.error(errMsg);
        this.isPlayStarting = false;
        return;
      }

      // 清空先前的错误
      this.$set(this.streamErrors, cameraType, null);

      try {
        console.log(`正在请求 ${cameraName} 视频流, 通道: ${channelId}`);
        const playRes = await playStart(channelId);
        if (!playRes || !playRes.address) {
          throw new Error('API 返回的数据格式异常，缺少 stream address');
        }

        const streamUrl = this.buildStreamUrl(playRes.address);
        if (!streamUrl) {
          throw new Error('未能从接口响应中解析出有效的视频流播放地址');
        }

        this.$set(this.videoUrlMap, cameraType, streamUrl);
        this.$set(this.streamErrors, cameraType, null);
        this.$message.success(`${cameraName} 推流成功`);
      } catch (error) {
        const errorDetail = error.response?.data?.message || error.message || '网络连接超时或接口异常';
        const fullMsg = `推流失败: ${errorDetail}`;
        this.$set(this.streamErrors, cameraType, fullMsg);
        this.$set(this.videoUrlMap, cameraType, null);
        this.$message.error(`${cameraName} ${fullMsg}`);
        console.error('推流请求失败:', error);
      } finally {
        this.isPlayStarting = false;
      }
    },

    // 重新连接当前视频流
    retryCurrentStream() {
      this.playStartFun(this.InOrOut);
    },

    // 手动刷新视频流
    async manualRefreshStream() {
      if (this.isRefreshingStream) return;
      this.isRefreshingStream = true;
      try {
        const type = this.InOrOut;
        this.$set(this.videoUrlMap, type, null);
        await this.$nextTick();

        if (this.currentChannelId) {
          try {
            await playStop(this.currentChannelId);
          } catch (e) {
            console.warn('停止旧流出错:', e);
          }
        }
        await this.wait(300);
        await this.playStartFun(type);
      } catch (e) {
        console.error('手动刷新失败:', e);
        this.$message.error('刷新流失败');
      } finally {
        this.isRefreshingStream = false;
      }
    },

    // 播放器组件错误回调
    handleVideoPlayerError(err) {
      const errText = typeof err === 'string' ? err : (err?.message || '视频播放异常');
      this.$set(this.streamErrors, this.InOrOut, `播放器内部错误: ${errText}`);
      this.$message.error(`播放错误: ${errText}`);
    },

    handlePlayStart() {
      this.$set(this.streamErrors, this.InOrOut, null);
    },

    handlePlayPause() {},

    // 全屏切换
    fullScreenChange() {
      if (this.$refs.VideoPlayer?.fullscreen) {
        this.$refs.VideoPlayer.fullscreen();
      }
    },

    // 切换功能标签页（云台 / 回放）
    switchControlTab(tab) {
      this.activeControlTab = tab;
      if (tab !== 'playback') {
        this.playbackVideoUrl = null;
      } else if (!this.selectedDate) {
        const today = new Date();
        this.selectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      }
    },

    // 退出回放模式
    exitPlaybackMode() {
      this.activeControlTab = 'ptz';
      this.playbackVideoUrl = null;
      this.selectedPlaybackUrl = null;
      this.playbackUrls = [];
      this.isPlaybackSearched = false;

      if (!this.currentLiveVideoUrl) {
        this.playStartFun(this.InOrOut);
      }
      this.$message.success('已切换回实时直播');
    },

    // 云台控制
    async ptzControlFun(command) {
      if (!this.currentChannelId || !this.deviceId) {
        this.$message.error('未获取到当前摄像头的有效设备 ID 或通道 ID');
        return;
      }

      const directionMap = {
        'up': 'TOP',
        'down': 'BOTTOM',
        'left': 'LEFT',
        'right': 'RIGHT',
        'leftup': 'TOP_LEFT',
        'rightup': 'TOP_RIGHT',
        'leftdown': 'BOTTOM_LEFT',
        'rightdown': 'BOTTOM_RIGHT',
        'FOCUS_IN': 'FOCUS_IN',
        'FOCUS_OUT': 'FOCUS_OUT',
        'ZOOM_OUT': 'ZOOM_OUT',
        'ZOOM_IN': 'ZOOM_IN'
      };

      const reverseMap = {
        'up': 'down',
        'down': 'up',
        'left': 'right',
        'right': 'left',
        'leftup': 'rightdown',
        'rightup': 'leftdown',
        'leftdown': 'rightup',
        'rightdown': 'leftup',
        'FOCUS_IN': 'FOCUS_IN',
        'FOCUS_OUT': 'FOCUS_OUT',
        'ZOOM_OUT': 'ZOOM_OUT',
        'ZOOM_IN': 'ZOOM_IN',
        'stop': 'stop'
      };

      try {
        if (command === 'stop') {
          await ptzControlStop(this.deviceId, this.currentChannelId, this.lastDirection);
        } else {
          const actualCommand = this.isPtzReversed && reverseMap[command] ? reverseMap[command] : command;
          const direction = directionMap[actualCommand];
          this.lastDirection = direction;
          await ptzControlStart(this.deviceId, this.currentChannelId, direction);
        }
      } catch (error) {
        console.error('云台控制异常:', error);
      }
    },

    // 切换云台翻转状态
    togglePtzReverse() {
      this.isPtzReversed = !this.isPtzReversed;
      const statusText = this.isPtzReversed ? '已开启' : '已关闭';
      this.$message.success(`云台方向翻转${statusText}`);
    },

    // 移动至预置位
    async yuzhiPointFun() {
      if (!this.currentChannelId) {
        this.$message.error('未检测到有效的通道 ID');
        return;
      }
      try {
        const res = await yuzhiPoint(this.currentChannelId);
        if (res && res.code === 0) {
          this.$message.success('摄像头已转到预置位');
        } else {
          this.$message.error('预置位控制失败：' + (res?.msg || '未知错误'));
        }
      } catch (error) {
        this.$message.error('预置位控制异常：' + error.message);
      }
    },

    // 远程重启摄像头服务
    async shutdownFun() {
      this.isRestarting = true;
      try {
        const res = await shutdown();
        if (res && (res.code === 0 || res.msg === '成功')) {
          this.$message.success('重启指令已下发，正在等待摄像头服务重启...');
          let count = 0;
          const checkTimer = setInterval(async () => {
            count++;
            try {
              const devRes = await getDevices();
              if (devRes && devRes.code === 0) {
                clearInterval(checkTimer);
                this.isRestarting = false;
                this.$message.success('摄像头服务重启完成，正在重新请求推流');
                this.playStartFun(this.InOrOut);
              }
            } catch (e) {
              // 仍未恢复
            }
            if (count > 12) {
              clearInterval(checkTimer);
              this.isRestarting = false;
              this.$message.warning('重启检测超时，请手动点击重试');
            }
          }, 3000);
        } else {
          this.isRestarting = false;
          this.$message.error('重启指令下发失败：' + (res?.msg || '未知'));
        }
      } catch (error) {
        this.isRestarting = false;
        this.$message.error('下发重启异常：' + (error.message || '网络连接失败'));
      }
    },

    // 双向语音对讲
    async startVoiceTalk() {
      if (this.isVoiceTalking) {
        this.$message.warning('对讲已经建立');
        return;
      }
      if (!this.currentChannelId) {
        this.$message.error('未获取到有效的通道 ID，无法开始对讲');
        return;
      }

      try {
        this.$message.info('正在建立双向语音对讲通道...');
        const response = await startTalk(this.currentChannelId);
        if (response?.talk_url) {
          let cleanTalkUrl = response.talk_url.startsWith('/') ? response.talk_url : '/' + response.talk_url;
          const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsPort = location.protocol === 'https:' ? '4433' : '20000';
          this.talkUrl = `${wsProtocol}//${this.getSystemIp()}:${wsPort}${cleanTalkUrl}`;
          this.transport = response.transport || 'tcp';
        }

        this.talkInstance = new Talk(
          this.talkUrl,
          {
            encType: 'g711a',
            packetType: 'rtp',
            sampleBitsWidth: 16,
            sampleRate: 8000,
            debugLevel: 'warn',
            packetTcpSendType: this.transport,
            engine: 'worklet',
            audioConstraints: {
              sampleRate: 48000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          },
          (errorMsg) => {
            this.$message.error('对讲错误: ' + errorMsg);
            this.stopVoiceTalk();
          },
          (message) => {
            console.log('对讲消息:', message);
          }
        );

        await this.talkInstance.startTalk();
        this.isVoiceTalking = true;
        this.$message.success('语音对讲已接通');
      } catch (error) {
        console.error('开始对讲失败:', error);
        this.$message.error('建立对讲失败: ' + (error.message || '未知错误'));
        this.cleanupTalkResources();
      }
    },

    stopVoiceTalk() {
      if (!this.isVoiceTalking) return;
      try {
        if (this.talkInstance) {
          this.talkInstance.stopTalk();
        }
        this.cleanupTalkResources();
        this.$message.success('语音对讲已关闭');
      } catch (error) {
        this.cleanupTalkResources();
      }
    },

    cleanupTalkResources() {
      if (this.talkInstance) {
        try {
          this.talkInstance.stopTalk();
        } catch (e) {}
        this.talkInstance = null;
      }
      this.isVoiceTalking = false;
      this.talkUrl = null;
      this.transport = null;
    },

    // 录像回放相关
    onDateChange() {
      this.playbackUrls = [];
      this.selectedPlaybackUrl = null;
      this.isPlaybackSearched = false;
    },

    constructPlaybackUrl(relativePath) {
      const cleanPath = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
      return this.getBaseURL() + '/proxy/sms/local' + cleanPath;
    },

    extractTimeSegment(url) {
      const regex = /\/(\d{14})-(\d+)\.mp4/;
      const match = url.match(regex);
      if (match) {
        const ts = match[1];
        return `${ts.substring(0, 4)}-${ts.substring(4, 6)}-${ts.substring(6, 8)} ${ts.substring(8, 10)}:${ts.substring(10, 12)}:${ts.substring(12, 14)}`;
      }
      const idx = this.playbackUrls.indexOf(url);
      return `录像切片 ${idx + 1}`;
    },

    async loadPlaybackVideo() {
      if (!this.selectedDate) {
        this.$message.warning('请先选择回放日期');
        return;
      }
      if (!this.currentChannelId) {
        this.$message.error('当前摄像头通道 ID 无效');
        return;
      }

      this.isSearchingPlayback = true;
      try {
        const startDate = new Date(this.selectedDate);
        startDate.setHours(0, 0, 0, 0);
        const startTime = startDate.getTime();

        const endDate = new Date(this.selectedDate);
        endDate.setHours(23, 59, 59, 999);
        const endTime = endDate.getTime();
        const ssrc = `${this.deviceId || 'dev'}_admin123`;

        await playBackInit(this.currentChannelId, 'CLOUD', startTime, endTime, ssrc);
        const res = await playBack(this.currentChannelId, startTime, endTime);

        this.isPlaybackSearched = true;
        this.playbackUrls = [];
        this.selectedPlaybackUrl = null;
        this.playbackVideoUrl = null;

        if (res && res.items && Array.isArray(res.items) && res.items.length > 0) {
          this.playbackUrls = res.items.map(item => {
            const rel = typeof item === 'string' ? item : item?.url;
            return rel ? this.constructPlaybackUrl(rel) : null;
          }).filter(Boolean).reverse();
          this.$message.success(`已检索到 ${this.playbackUrls.length} 个录像切片`);
        } else {
          this.$message.info('该日期未找到录像切片');
        }
      } catch (error) {
        console.error('加载回放异常:', error);
        this.$message.error('加载回放失败：' + (error.response?.data?.message || error.message));
      } finally {
        this.isSearchingPlayback = false;
      }
    },

    selectPlaybackUrl(url) {
      this.selectedPlaybackUrl = url;
    },

    playSelectedPlayback() {
      if (!this.selectedPlaybackUrl) {
        this.$message.warning('请先选择一个录像切片');
        return;
      }
      this.playbackVideoUrl = this.selectedPlaybackUrl;
      this.$message.success('开始播放录像切片');
    },

    setupVisibilityHandler() {
      this.visibilityChangeHandler = () => {
        if (document.hidden) {
          this.$refs.VideoPlayer?.pause?.();
        } else if (this.currentLiveVideoUrl) {
          this.$refs.VideoPlayer?.play?.();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    },

    cleanupVisibilityHandler() {
      if (this.visibilityChangeHandler) {
        document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
        this.visibilityChangeHandler = null;
      }
    }
  },
  beforeDestroy() {
    this.cleanupVisibilityHandler();
    this.cleanupTalkResources();
    if (this.currentChannelId) {
      playStop(this.currentChannelId).catch(() => {});
    }
  }
};
</script>

<style scoped>
.substance {
  width: 100%;
  height: 100%;
  padding: 14px;
  box-sizing: border-box;
  background-color: #0b132b;
}

.MonitorSystem {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  gap: 12px;
}

/* 顶部通道栏 */
.channel-bar-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(28, 37, 65, 0.7);
  border: 1px solid rgba(58, 80, 107, 0.6);
  border-radius: 8px;
  padding: 6px 14px;
  backdrop-filter: blur(8px);
}

.channel-scroll-container {
  display: flex;
  overflow-x: auto;
  flex: 1;
}

.inOrOut {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 10px;
}

.inOrOut li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(11, 19, 43, 0.6);
  border: 1px solid rgba(58, 80, 107, 0.4);
  border-radius: 6px;
  color: #a0aec0;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.25s ease;
}

.inOrOut li:hover {
  background: rgba(31, 64, 104, 0.6);
  color: #fff;
  border-color: #1991c2;
}

.inOrOut li.activeLi {
  background: linear-gradient(135deg, #1991c2 0%, #0f4c81 100%);
  color: #ffffff;
  border-color: #48cae4;
  box-shadow: 0 0 12px rgba(25, 145, 194, 0.45);
  font-weight: 600;
}

.channel-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: bold;
}

.channel-badge.live {
  background: rgba(82, 196, 26, 0.25);
  color: #52c41a;
  border: 1px solid #52c41a;
}

.channel-badge.error {
  background: rgba(255, 77, 79, 0.25);
  color: #ff4d4f;
  border: 1px solid #ff4d4f;
}

.channel-badge.idle {
  background: rgba(160, 174, 192, 0.2);
  color: #a0aec0;
}

.channel-actions {
  margin-left: 14px;
}

.action-mini-btn {
  background: rgba(31, 64, 104, 0.8);
  color: #e2e8f0;
  border: 1px solid #3a506b;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-mini-btn:hover {
  background: #1991c2;
  color: #fff;
}

/* 主内容布局 */
.flex-box {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 14px;
}

/* 播放视窗 */
.RealTimeMonitor {
  position: relative;
  flex: 1;
  min-width: 0;
  background: #000000;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(58, 80, 107, 0.5);
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.8);
}

.player-hud {
  position: absolute;
  top: 12px;
  left: 14px;
  right: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
  pointer-events: none;
}

.hud-left {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(11, 19, 43, 0.75);
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(4px);
}

.hud-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff4d4f;
}

.hud-status-dot.active {
  background: #52c41a;
  box-shadow: 0 0 8px #52c41a;
}

.hud-name {
  font-size: 13px;
  font-weight: bold;
  color: #ffffff;
}

.hud-channel-tag {
  font-size: 11px;
  color: #a0aec0;
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 6px;
  border-radius: 3px;
}

.hud-mode-badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.hud-mode-badge.live {
  background: rgba(82, 196, 26, 0.2);
  color: #73d13d;
  border: 1px solid rgba(82, 196, 26, 0.4);
}

.hud-mode-badge.playback {
  background: rgba(250, 173, 20, 0.2);
  color: #faad14;
  border: 1px solid rgba(250, 173, 20, 0.4);
}

.mainVideoPlay,
.playbackVideoContainer {
  width: 100%;
  height: 100%;
}

/* 错误与异常遮罩卡片 */
.stream-error-overlay {
  position: absolute;
  inset: 0;
  background: rgba(8, 14, 28, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  padding: 20px;
  backdrop-filter: blur(6px);
}

.stream-error-card {
  background: #141f36;
  border: 1px solid #ff4d4f;
  border-radius: 8px;
  padding: 24px 32px;
  max-width: 480px;
  width: 100%;
  text-align: center;
  box-shadow: 0 12px 36px rgba(255, 77, 79, 0.2);
}

.error-badge-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.stream-error-title {
  font-size: 18px;
  font-weight: bold;
  color: #ff7875;
  margin-bottom: 12px;
}

.stream-error-message {
  background: rgba(255, 77, 79, 0.1);
  border: 1px solid rgba(255, 77, 79, 0.3);
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  color: #ffccc7;
  margin-bottom: 14px;
  word-break: break-word;
  text-align: left;
}

.stream-error-info {
  display: flex;
  justify-content: space-around;
  font-size: 12px;
  color: #a0aec0;
  margin-bottom: 20px;
}

.stream-error-info code {
  color: #48cae4;
}

.stream-error-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 浮动控制栏 */
.video-floating-controls {
  position: absolute;
  bottom: 14px;
  right: 14px;
  display: flex;
  gap: 8px;
  z-index: 10;
}

.float-btn {
  background: rgba(11, 19, 43, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  backdrop-filter: blur(4px);
}

.float-btn:hover {
  background: #1991c2;
  border-color: #48cae4;
}

/* 回放未选切片提示卡片 */
.playbackEmptyContainer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0b132b;
}

.empty-tip-card {
  text-align: center;
  padding: 30px;
  background: #1c2541;
  border: 1px solid #3a506b;
  border-radius: 8px;
  max-width: 400px;
}

.empty-icon {
  font-size: 44px;
  margin-bottom: 12px;
}

.empty-title {
  font-size: 18px;
  font-weight: bold;
  color: #ffffff;
  margin-bottom: 8px;
}

.empty-sub {
  font-size: 13px;
  color: #a0aec0;
  margin-bottom: 20px;
  line-height: 1.5;
}

/* 右侧面板 */
.right-control {
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  background: #1c2541;
  border: 1px solid #3a506b;
  border-radius: 8px;
  overflow: hidden;
}

.controlMenuBox {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  border-bottom: 1px solid #3a506b;
  background: rgba(11, 19, 43, 0.4);
}

.controlMenuBox li {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: #a0aec0;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.controlMenuBox li:hover {
  color: #ffffff;
}

.controlMenuBox li.activeLi {
  color: #48cae4;
  border-bottom: 2px solid #48cae4;
  background: rgba(25, 145, 194, 0.15);
  font-weight: 600;
}

.controlInner {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ptz-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.camera-tag {
  font-size: 14px;
  font-weight: bold;
  color: #48cae4;
}

.ptz-reverse-tag {
  font-size: 11px;
  color: #e2e8f0;
  background: rgba(245, 158, 11, 0.3);
  border: 1px solid #f59e0b;
  padding: 2px 6px;
  border-radius: 4px;
}

/* 八方向云台九宫格 */
.ptz-controller-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  background: rgba(11, 19, 43, 0.5);
  padding: 14px;
  border-radius: 8px;
  border: 1px solid rgba(58, 80, 107, 0.4);
}

.ptz-row {
  display: flex;
  gap: 8px;
}

.ptz-dir-btn {
  width: 52px;
  height: 44px;
  background: #1f4068;
  border: 1px solid #3a506b;
  color: #ffffff;
  font-size: 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ptz-dir-btn:hover {
  background: #1991c2;
  border-color: #48cae4;
  transform: scale(1.04);
}

.ptz-dir-btn:active {
  background: #0f4c81;
  transform: scale(0.96);
}

.ptz-dir-btn.center-btn {
  background: rgba(25, 145, 194, 0.25);
  border-color: #1991c2;
}

/* 调节工具 */
.ptz-action-tools {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(11, 19, 43, 0.4);
  padding: 12px;
  border-radius: 6px;
}

.tool-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-label {
  font-size: 13px;
  color: #a0aec0;
  width: 40px;
}

.btn-tool {
  flex: 1;
  padding: 6px 10px;
  background: #1f4068;
  border: 1px solid #3a506b;
  color: #ffffff;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-tool:hover {
  background: #1991c2;
}

.btn-tool.full-width {
  width: 100%;
}

.btn-tool.active {
  background: #d97706;
  border-color: #f59e0b;
}

/* 语音对讲 */
.VoiceIntercom {
  background: rgba(11, 19, 43, 0.5);
  border: 1px solid rgba(58, 80, 107, 0.5);
  border-radius: 8px;
  padding: 12px;
}

.intercom-title {
  font-size: 13px;
  font-weight: bold;
  color: #ffffff;
  margin-bottom: 10px;
}

.intercom-btn-group {
  display: flex;
  gap: 8px;
}

.btn-intercom {
  flex: 1;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-intercom.start {
  background: #1991c2;
  color: #ffffff;
}

.btn-intercom.start:hover:not(:disabled) {
  background: #167a9f;
}

.btn-intercom.stop {
  background: #4a5568;
  color: #ffffff;
}

.btn-intercom.stop:hover:not(:disabled) {
  background: #e53e3e;
}

.btn-intercom:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-intercom.btn-talking {
  background: #38a169;
  animation: pulse 1.5s infinite;
}

.talk-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  color: #48bb78;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #48bb78;
  box-shadow: 0 0 8px #48bb78;
}

/* 回放面板 */
.controlInner--playback {
  padding: 14px;
}

.playbackChoose {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
}

.playback-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.playback-row label {
  font-size: 13px;
  color: #a0aec0;
  width: 70px;
}

.playbackControls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.playback-action-row {
  display: flex;
  gap: 8px;
}

.btn-action {
  padding: 8px 14px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
}

.btn-action.primary {
  background: #1991c2;
  color: #ffffff;
}

.btn-action.primary:hover:not(:disabled) {
  background: #1377a0;
}

.btn-action.secondary {
  background: #3a506b;
  color: #ffffff;
}

.btn-action.secondary:hover {
  background: #4a6688;
}

.btn-action.restart {
  background: #c53030;
  color: #ffffff;
}

.btn-action.restart:hover:not(:disabled) {
  background: #9b2c2c;
}

.btn-action.play-btn {
  background: #38a169;
  color: #ffffff;
  padding: 10px;
}

.btn-action.play-btn:hover {
  background: #2f855a;
}

.btn-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.playback-url-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(11, 19, 43, 0.6);
  border: 1px solid #3a506b;
  border-radius: 6px;
  overflow: hidden;
  min-height: 180px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: bold;
  background: rgba(31, 64, 104, 0.4);
  border-bottom: 1px solid #3a506b;
}

.list-count {
  color: #48cae4;
}

.url-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.url-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: 12px;
  color: #cbd5e0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 4px;
}

.url-item:hover {
  background: rgba(25, 145, 194, 0.25);
  color: #ffffff;
}

.url-item.selected {
  background: #1991c2;
  color: #ffffff;
  font-weight: 600;
}

.playback-empty-records {
  padding: 14px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 6px;
  font-size: 12px;
  color: #f6ad55;
  text-align: center;
}
</style>
