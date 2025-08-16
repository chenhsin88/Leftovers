// in: src/app/@Services/role.guard.ts

import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { UsersServicesService } from './users-services.service';
import { TriggerAlertService } from './trigger-alert.service';

/**
 * 這是一個基於角色的路由守衛。
 * 它會檢查當前登入的使用者角色，是否符合進入該路由所需的角色權限。
 *
 * 如何使用：
 * 在 app.routes.ts 中，針對需要保護的路由設定：
 * {
 * path: 'some-merchant-page',
 * component: MerchantPageComponent,
 * canActivate: [authGuard, roleGuard], // 先檢查登入，再檢查角色
 * data: {
 * expectedRole: 'merchants' // 在 data 中定義此路由期望的角色
 * }
 * }
 */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const userService = inject(UsersServicesService);
  const router = inject(Router);
  const triggerAlertService = inject(TriggerAlertService);

  // 1. 從路由設定的 data 物件中，取得這個路由期望的角色
  const expectedRole = route.data['expectedRole'];
  if (!expectedRole) {
    // 如果路由沒有設定 expectedRole，為避免意外，直接允許通過。
    console.warn('路由未設定 expectedRole，已自動放行:', route.url);
    return true;
  }

  // 2. 取得當前登入的使用者
  const currentUser = userService.currentUserValue;
  const userRole = currentUser?.role;

  // 3. 進行角色比對
  if (userRole === expectedRole) {
    // 角色符合，允許進入
    return true;
  } else {
    // 角色不符，顯示警告並導向到他們各自的首頁
    triggerAlertService.trigger('您的身分無法訪問此頁面', 'error', 4000);

    if (userRole === 'merchants') {
      // 如果一個商家想去顧客頁面，把他導回商家列表
      router.navigate(['/storeList']);
    } else {
      // 如果一個顧客想去商家頁面，把他導回主頁
      router.navigate(['/main']);
    }

    return false; // 阻止導航
  }
};
