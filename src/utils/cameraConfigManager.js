/**
 * 摄像头配置管理工具
 * 负责从后端 API 动态获取所有接入的通道，并提供多级缓存与降级机制
 */

import { getChannel } from '../api/monitorSystem';

const CONFIG_STORAGE_KEY = 'cameraConfigs_dynamic';
const CONFIG_TIMESTAMP_KEY = 'cameraConfigsTimestamp_dynamic';
const CONFIG_CACHE_DURATION = 2 * 60 * 60 * 1000; // 2小时缓存

// 默认备用配置（仅在完全无法连接 API 时使用）
const DEFAULT_CONFIGS = [
  {
    cameraType: 1,
    deviceId: "34020000001110000047",
    channelId: "34020000001110000047_34020000001320000001",
    channelName: "摄像头 1",
    status: "online",
    source: 'default'
  },
  {
    cameraType: 2,
    deviceId: "34020000002000000048",
    channelId: "34020000002000000048_34020000002000000001",
    channelName: "摄像头 2",
    status: "online",
    source: 'default'
  },
  {
    cameraType: 3,
    deviceId: "34020000001320000048",
    channelId: "34020000001320000048_34020000001320000002",
    channelName: "摄像头 3",
    status: "online",
    source: 'default'
  }
];

class CameraConfigManager {
  constructor() {
    this.configs = [];
    this.lastUpdateTime = null;
  }

  /**
   * 初始化配置 - 动态探测策略
   * @returns {Promise<Array>} 摄像头配置数组
   */
  async initializeConfigs() {
    // 策略0: 内存缓存未过期
    if (this.configs.length > 0 && !this.shouldAutoRefresh()) {
      return this.configs;
    }

    // 策略1: 动态通过 API 获取接入的全部通道
    try {
      const dynamicConfigs = await this.getDynamicConfigs();
      if (dynamicConfigs && dynamicConfigs.length > 0) {
        this.configs = dynamicConfigs;
        this.saveConfigs();
        return this.configs;
      }
    } catch (error) {
      console.warn('动态获取摄像头通道失败:', error.message);
      // 继续尝试缓存或默认
    }

    // 策略2: 使用本地缓存
    const cachedConfigs = this.loadCachedConfigs();
    if (cachedConfigs?.length > 0) {
      this.configs = cachedConfigs;
      return this.configs;
    }

    // 策略3: 降级到默认配置
    this.configs = this.getDefaultConfigs();
    this.saveConfigs();
    return this.configs;
  }

  /**
   * 获取动态配置 - 解析后端全部接入的通道
   * @returns {Promise<Array>}
   */
  async getDynamicConfigs() {
    const channelRes = await getChannel();

    if (!channelRes || !channelRes.items || !Array.isArray(channelRes.items) || channelRes.items.length === 0) {
      return [];
    }

    // 动态映射所有通道，不再硬编码数量
    return channelRes.items.map((item, index) => {
      const channelId = item.id || item.channelId || item.channel_id || '';
      const deviceId = item.device_id || item.deviceId || (channelId.includes('_') ? channelId.split('_')[0] : '');
      const rawName = (item.name || item.channelName || '').trim();
      const channelName = rawName || `摄像头 ${index + 1}`;

      return {
        cameraType: index + 1,
        deviceId,
        channelId,
        channelName,
        status: item.status || 'online',
        source: 'api'
      };
    });
  }

  /**
   * 加载缓存配置
   * @returns {Array|null}
   */
  loadCachedConfigs() {
    try {
      const configStr = localStorage.getItem(CONFIG_STORAGE_KEY);
      const timestamp = localStorage.getItem(CONFIG_TIMESTAMP_KEY);

      if (!configStr) return null;

      const cacheAge = Date.now() - parseInt(timestamp || '0');
      if (cacheAge > CONFIG_CACHE_DURATION) {
        return null;
      }

      const configs = JSON.parse(configStr);
      if (Array.isArray(configs) && configs.length > 0) {
        return configs;
      }
    } catch (error) {
      console.error('解析缓存配置失败:', error);
    }
    return null;
  }

  /**
   * 保存配置到缓存
   */
  saveConfigs() {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.configs));
      localStorage.setItem(CONFIG_TIMESTAMP_KEY, Date.now().toString());
      this.lastUpdateTime = Date.now();
    } catch (error) {
      console.error('保存配置失败:', error);
    }
  }

  /**
   * 获取默认配置副本
   */
  getDefaultConfigs() {
    return DEFAULT_CONFIGS.map(config => ({
      ...config,
      timestamp: Date.now()
    }));
  }

  /**
   * 手动强制刷新配置
   */
  async refreshConfigs() {
    try {
      const dynamicConfigs = await this.getDynamicConfigs();
      if (dynamicConfigs && dynamicConfigs.length > 0) {
        this.configs = dynamicConfigs;
        this.saveConfigs();
        return this.configs;
      } else {
        throw new Error('未检索到可用通道');
      }
    } catch (error) {
      console.error('刷新通道失败:', error);
      throw error;
    }
  }

  shouldAutoRefresh() {
    if (!this.lastUpdateTime) return true;
    return (Date.now() - this.lastUpdateTime) > CONFIG_CACHE_DURATION;
  }

  getCurrentConfigs() {
    return this.configs;
  }

  getConfigByCameraType(cameraType) {
    return this.configs.find(config => config.cameraType === cameraType) || null;
  }
}

export default new CameraConfigManager();
export { DEFAULT_CONFIGS };
