import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '首页概览', icon: 'Odometer' },
      },
      {
        path: 'room-map',
        name: 'RoomMap',
        component: () => import('../views/RoomMap.vue'),
        meta: { title: '房态图', icon: 'Grid' },
      },
      {
        path: 'bookings',
        name: 'Bookings',
        component: () => import('../views/Bookings.vue'),
        meta: { title: '预订管理', icon: 'Calendar' },
      },
      {
        path: 'checkin',
        name: 'Checkin',
        component: () => import('../views/Checkin.vue'),
        meta: { title: '入住管理', icon: 'Key' },
      },
      {
        path: 'checkout',
        name: 'Checkout',
        component: () => import('../views/Checkout.vue'),
        meta: { title: '退房结算', icon: 'Wallet' },
      },
      {
        path: 'invoices',
        name: 'Invoices',
        component: () => import('../views/Invoices.vue'),
        meta: { title: '发票管理', icon: 'Document' },
      },
      {
        path: 'channels',
        name: 'Channels',
        component: () => import('../views/Channels.vue'),
        meta: { title: '渠道管理', icon: 'Connection' },
      },
      {
        path: 'reports',
        name: 'Reports',
        component: () => import('../views/Reports.vue'),
        meta: { title: '数据报表', icon: 'DataAnalysis' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  
  if (to.meta.requiresAuth && !userStore.token) {
    next({ path: '/login', query: { redirect: to.fullPath } })
  } else {
    next()
  }
})

export default router
