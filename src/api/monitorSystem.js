import axios from 'axios';
function getBaseURL() {
  const systemIp = location.hostname;
  // const systemIp = '192.168.200.41';
  console.log(systemIp);
  if (location.protocol === 'https:') {
    return `${location.protocol}//${systemIp}:4433`;
  } else {
    return `${location.protocol}//${systemIp}:20000`;
  }
}
// 创建专门用于摄像头请求的axios实例
const cameraAxios = axios.create({
  auth:{
    username:'admin123',
    password:'admin123'
  }
});
cameraAxios.interceptors.request.use(config => {
  config.baseURL = getBaseURL();
  return config;
});
// 获取通道列表
export function getChannel() {
  return cameraAxios.get('/channels');
}

// 开始播放
export function playStart(channelId) {
  return cameraAxios.post(`/channels/${channelId}/play`);
}

// PTZ控制开始
export function ptzControlStart(deviceId,channelId, direction) {
  return cameraAxios.post(`/devices/${deviceId}/ptz/start`, {
    speed: 50,
    direction: direction,
    channel_id: channelId
  });
}

// PTZ控制停止
export function ptzControlStop(deviceId,channelId, direction) {
  return cameraAxios.post(`/devices/${deviceId}/ptz/stop`, {
    speed: 0,
    direction: direction,
    channel_id: channelId
  });
}

// 停止播放
export function playStop(channelId) {
  return cameraAxios.delete(`/channels/${channelId}/play`);
}
//语音对讲
export function startTalk(channelId) {
  return cameraAxios.post(`/channels/${channelId}/talk`);
}
// 获取设备列表
export function getDevices() {
  return cameraAxios.get('/devices');
}

// 获取设备详细信息
export function getDeviceDetail(deviceId) {
  return cameraAxios.get(`/devices/${deviceId}`);
}

// 获取设备的通道列表
export function getDeviceChannels(deviceId) {
  return cameraAxios.get(`/devices/${deviceId}/channels`);
}

// 移动至预置点
export function yuzhiPoint(channelId) {
  return cameraAxios.post(`/devices/${channelId}/ptz/preset`, {
    channel_id: channelId,
    preset: 1  // 默认使用预置点1
  });
}

// 重启摄像头服务
export function shutdown() {
  return cameraAxios.post('/system/restart');
}
//开始回放前必须调用这个接口
export function playBackInit(channelId,source='CLOUD',startTime,endTime,ssrc){
  return cameraAxios.get('/records', {
  params:{
    channel_id: channelId,
    source: source,
    start: startTime,
    end: endTime,
    ssrc}
  });
}
//开始回放
export function playBack(channelId,startTime,endTime,source='CLOUD'){
  return cameraAxios.get('/records/hls/index.m3u8',{
    params:{
      channel_id:channelId,
      start:startTime,
      end:endTime,
      source:source
    }
  })
}
// 处理响应错误
cameraAxios.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response) {
      switch (error.response.status) {
        case 403:
          console.error('摄像头访问权限被拒绝');
          break;
        case 401:
          console.error('摄像头认证失败');
          break;
        default:
          console.error('摄像头接口请求失败:', error.message);
      }
    }
    return Promise.reject(error);
  }
);
