// in: src/app/@Services/login.guard.ts

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UsersServicesService } from './users-services.service';
import { map, take } from 'rxjs/operators';

/**
 * 這是一個路由守衛，用於防止「已登入」的使用者訪問登入或註冊等頁面。
 * 它會根據使用者的角色，將其導向到對應的主頁。
 */
export const loginGuard: CanActivateFn = (route, state) => {
  const userService = inject(UsersServicesService);
  const router = inject(Router);

  // 我們需要同時取得「登入狀態」和「使用者角色」
  return userService.isLoggedIn$.pipe(
    take(1),
    map(isLoggedIn => {
      if (isLoggedIn) {
        // 如果使用者已登入，我們接著檢查他的角色
        const currentUser = userService.currentUserValue; // 使用我們之前建立的 getter

        if (currentUser?.role === 'merchants') {
          // 如果是商家，導向商家後台
          console.log('[LoginGuard] 商家已登入，導航至 /storeList。');
          router.navigate(['/storeList']);
        } else {
          // 否則 (是顧客或角色未定)，一律導向顧客主頁
          console.log('[LoginGuard] 顧客已登入，導航至 /main。');
          router.navigate(['/main']);
        }

        return false; // 回傳 false，阻止進入 /login 或 /signup 頁面
      } else {
        // 如果使用者未登入，就允許他進入
        console.log('[LoginGuard] 使用者未登入，允許進入。');
        return true;
      }
    })
  );
};
