// in: src/app/@Services/location.guard.ts

import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { UsersServicesService } from './users-services.service';
import { map, take } from 'rxjs/operators';
import { TriggerAlertService } from './trigger-alert.service';

/**
 * 這是一個路由守衛，用於檢查使用者是否已設定地理位置。
 * 如果沒有設定，它會將使用者重新導向到 '/location' 頁面，並附帶 returnUrl。
 */
export const locationGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  // 1. 使用 inject() 來取得我們需要的服務
  const userService = inject(UsersServicesService);
  const router = inject(Router);
  const triggerAlertService = inject(TriggerAlertService);

  // 2. 訂閱 usersServicesService 中的 location$ 狀態
  return userService.location$.pipe(
    take(1), // take(1) 表示我們只取一次當前的狀態值，然後就自動取消訂閱，這是守衛的最佳實踐
    map(location => {
      // 3. 進行判斷
      if (location) {
        // 如果 location 物件存在 (不是 null)，表示使用者已設定位置
        console.log('[LocationGuard] 位置已設定，允許進入。');
        return true; // 回傳 true，允許導航繼續
      } else {
        // 如果 location 是 null，表示使用者尚未設定位置
        console.log('[LocationGuard] 未設定位置，導航至 /location 頁面。');
        triggerAlertService.trigger('請先設定您的位置才能繼續喔！', 'info', 4000);

        // 4. 導航到 /location 頁面，並將使用者「原本想去的路徑 (state.url)」
        //    當作 returnUrl 查詢參數附加到網址上
        router.navigate(['/location'], { queryParams: { returnUrl: state.url } });

        return false; // 回傳 false，阻止本次導航
      }
    })
  );
};
