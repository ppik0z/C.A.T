import { createRouter, createWebHistory } from "vue-router";

export const loadLoginView = () => import("../views/LoginView.vue");

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "dashboard",
      component: () => import("../pages/MessageDashboard.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/login",
      name: "login",
      component: loadLoginView,
      meta: { guestOnly: true },
    },
    {
      path: "/forgot-password",
      name: "forgot-password",
      component: () => import("../views/ForgotPasswordView.vue"),
      meta: { publicAuthAction: true },
    },
    {
      path: "/reset-password",
      name: "reset-password",
      component: () => import("../views/ResetPasswordView.vue"),
      meta: { publicAuthAction: true },
    },
    {
      path: "/verify-email",
      name: "verify-email",
      component: () => import("../views/VerifyEmailView.vue"),
      meta: { publicAuthAction: true },
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/",
    },
  ],
});
