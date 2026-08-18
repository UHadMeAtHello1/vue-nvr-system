import Vue from 'vue'
import VueRouter from 'vue-router'
import NVRdemo from '@/components/NVRdemo.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    redirect: '/monitor'
  },
  {
    path: '/monitor',
    name: 'Monitor',
    component: NVRdemo,
    meta: { title: '实时监控与云台' }
  },
  {
    path: '*',
    redirect: '/monitor'
  }
]

const router = new VueRouter({
  mode: 'hash',
  base: process.env.BASE_URL,
  routes
})

export default router
