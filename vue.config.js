const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  lintOnSave: false,
  devServer: {
    port: 8080,
    proxy: {
      '/ISAPI': {
        target: 'http://192.168.200.168',
        changeOrigin: true
      },
      '/channels': {
        target: 'http://192.168.200.41:20000',
        changeOrigin: true
      },
      '/devices': {
        target: 'http://192.168.200.41:20000',
        changeOrigin: true
      },
      '/records': {
        target: 'http://192.168.200.41:20000',
        changeOrigin: true
      }
    }
  }
})
