/**
 * 语音对讲封装类 - 基于EasyPlayerProTalk.js
 */
export default class Talk {
  constructor(wsUrl, configs, errorCallback, messageCallback) {
    // 确保EasyPlayerProTalk已加载
    if (!window.EasyPlayerProTalk) {
      throw new Error('EasyPlayerProTalk.js 未加载');
    }

    this.talk = new window.EasyPlayerProTalk({
      saveRtpToFile: false,
    });
    this.wsUrl = wsUrl;
    this.configs = configs;
    this.errorCallback = errorCallback;
    this.messageCallback = messageCallback;
    this._onWsMessage();
    
    // 添加音频质量监控
    this._setupAudioMonitoring();
  }

  /**
   * 开始对讲
   */
  async startTalk() {
    if (this.talk && this.wsUrl) {
      try {
        // 合并音频优化配置
        const finalConfigs = {
          debug: false,
          saveRtpToFile: false,
          testMicrophone: false,
          getUserMediaTimeout: 5000,
          ...this.configs
        };
        
        await this.talk.startTalk(this.wsUrl, finalConfigs);
      } catch (err) {
        if (
          !window.location.origin.startsWith('https') &&
          !window.location.hostname.includes('localhost')
        ) {
          this.errorCallback('浏览器需要HTTPS才能采集音频!');
        } else {
          this.errorCallback('连接语音失败!');
        }
        throw err;
      }
    } else {
      if (!this.talk) {
        this.errorCallback('创建语音失败，请重试!');
      }
      if (!this.wsUrl) {
        this.errorCallback('连接语音失败!');
      }
    }
  }

  /**
   * 停止对讲
   */
  async stopTalk() {
    if (this.talk) {
      try {
        await this.talk.stopTalk();
        this.talk.destroy();
        this.talk = null;
      } catch (e) {
        console.error('stop talk error', e);
        throw e;
      }
    } else {
      console.log('EasyPlayerProTalk is not ready');
    }
  }

  /**
   * 处理WebSocket消息
   */
  _onWsMessage() {
    if (!this.talk) return;

    this.talk.on('talkStreamMessage', (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        data = event.data;
      }
      
      if (data.type === 'DISCONNECT' || data.type === 'ERROR') {
        this.errorCallback(data.msg);
        return;
      }
      
      if (this.messageCallback) {
        this.messageCallback(data);
      }
    });

    this.talk.on('talkStreamError', (event) => {
      this.errorCallback('连接语音失败!');
    });
  }

  /**
   * 检查是否已初始化
   */
  isReady() {
    return !!(this.talk && this.wsUrl);
  }

  /**
   * 设置音频质量监控
   */
  _setupAudioMonitoring() {
    if (!this.talk) return;

    // 监听音频流状态
    this.talk.on('talkGetUserMediaSuccess', () => {
      console.log('✅ 音频采集成功');
    });

    this.talk.on('talkGetUserMediaFail', (error) => {
      console.error('❌ 音频采集失败:', error);
      this.errorCallback('音频采集失败，请检查麦克风权限');
    });

    this.talk.on('talkStreamStart', () => {
      console.log('🎤 音频流开始传输');
    });

    this.talk.on('talkStreamInactive', () => {
      console.warn('⚠️ 音频流非活动状态');
      this.errorCallback('音频设备非活动，可能影响音频质量');
    });

    this.talk.on('talkGetUserMediaTimeout', () => {
      console.error('⏰ 音频采集超时');
      this.errorCallback('音频采集超时，请检查设备');
    });
  }
}