import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { MerchantsService } from './merchants.service';
import { TriggerAlertService } from './trigger-alert.service';

export const hasStoresGuard: CanActivateFn = (route, state) => {
  // 注入需要的服務
  const merchantsService = inject(MerchantsService);
  const router = inject(Router);
  const triggerAlert = inject(TriggerAlertService);

  // 呼叫您在 MerchantsService 中建立的方法
  return merchantsService.checkAndCacheUserHasStores().pipe(
    map(hasStores => {
      // 根據 Service 回傳的布林值進行判斷
      if (hasStores) {
        // 如果有店家，允許導航
        return true;
      } else {
        // 如果沒有店家，顯示警告並導向到店家註冊頁
        triggerAlert.trigger('您尚未建立店家資料請先建立', 'warning', 4000);
        router.navigate(['/merchantRegistration']);
        // 阻擋導航
        return false;
      }
    })
  );
};
