// in: src/app/@Services/auth.guard.ts

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UsersServicesService } from './users-services.service';
import { map, take } from 'rxjs/operators';
import { TriggerAlertService } from './trigger-alert.service';

export const authGuard: CanActivateFn = (route, state) => {
  const userService = inject(UsersServicesService);
  const router = inject(Router);
  const triggerAlertService = inject(TriggerAlertService);

  return userService.isLoggedIn$.pipe(
    take(1),
    map(isLoggedIn => {
      // 同時檢查「登入狀態」和「Token 有效性」
      if (isLoggedIn && userService.isAccessTokenValid()) {
        return true;
      } else {
        triggerAlertService.trigger('請先登入', 'warning', 5000);
        router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }
    })
  );
};
